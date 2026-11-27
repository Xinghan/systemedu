import SwiftUI
import QuickLook
import UniformTypeIdentifiers

enum ClassroomMaterialError: LocalizedError {
    case unavailable, tooLarge
    var errorDescription: String? {
        switch self {
        case .unavailable: return "这份资料暂时无法打开。请重试，或返回课堂继续阅读。"
        case .tooLarge: return "这份资料超过 50 MB，暂时无法在 App 内打开。"
        }
    }
}

enum ClassroomMaterial {
    static let limit = 50_000_000
    static let downloadExtensions: Set<String> = ["pdf", "csv", "tsv", "ipynb", "zip", "json", "txt", "md", "py", "stl", "scad", "xlsx", "docx", "pptx", "fits", "gz"]
    static func isRemoteFile(_ url: URL) -> Bool {
        url.scheme == "https" && downloadExtensions.contains(url.pathExtension.lowercased())
    }
    // Keep Unicode filenames, but never let a supplied name select a directory.
    static func filename(_ value: String) -> String {
        let forbidden = CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "/\\:"))
        let clean = value.components(separatedBy: forbidden).joined(separator: "_").trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty || clean == "." || clean == ".." ? "课堂资料" : String(clean.prefix(180))
    }
    static func copyForPreview(_ source: URL, name: String? = nil) throws -> URL {
        let values = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true else { throw ClassroomMaterialError.unavailable }
        guard (values.fileSize ?? 0) <= limit else { throw ClassroomMaterialError.tooLarge }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("material-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let target = directory.appendingPathComponent(filename(name ?? source.lastPathComponent))
        do { try FileManager.default.copyItem(at: source, to: target); return target }
        catch { try? FileManager.default.removeItem(at: directory); throw error }
    }
    static func prepare(_ source: URL) async throws -> URL {
        if source.isFileURL { return try copyForPreview(source) }
        guard source.scheme == "https" else { throw ClassroomMaterialError.unavailable }
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 30; config.timeoutIntervalForResource = 90
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let (temporary, response) = try await session.download(from: source)
        defer { try? FileManager.default.removeItem(at: temporary) }
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              http.url?.scheme == "https", http.mimeType != "text/html" else { throw ClassroomMaterialError.unavailable }
        return try copyForPreview(temporary, name: response.suggestedFilename ?? source.lastPathComponent)
    }
    static func textPreview(_ url: URL) -> String? {
        guard ["csv", "tsv", "json", "ipynb", "py", "txt", "md"].contains(url.pathExtension.lowercased()),
              let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        let notebookFile = url.pathExtension.lowercased() == "ipynb"
        guard let bytes = try? handle.read(upToCount: notebookFile ? 5_000_000 : 180_000) else { return nil }
        if notebookFile {
            guard let notebook = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
                  let cells = notebook["cells"] as? [[String: Any]] else { return "这份笔记本暂时无法完整预览。保存到「文件」后，可在支持 Jupyter 的环境打开。" }
            let content = cells.compactMap { cell -> String? in
                let source = (cell["source"] as? [String])?.joined() ?? cell["source"] as? String
                return source.map { (cell["cell_type"] as? String == "code" ? "【代码】\n" : "") + $0 }
            }.joined(separator: "\n\n")
            return String(content.prefix(120_000)) + (content.count > 120_000 ? "\n\n（预览到此，保存后可查看完整文件。）" : "")
        }
        let text = String(decoding: bytes, as: UTF8.self)
        if ["csv", "tsv"].contains(url.pathExtension.lowercased()) {
            let lines = text.components(separatedBy: "\n")
            // Keep large data tables responsive; saving always exports the complete original.
            return lines.prefix(201).joined(separator: "\n") + (lines.count > 201 || bytes.count == 180_000 ? "\n\n（预览到此，保存后可查看完整文件。）" : "")
        }
        return text + (bytes.count == 180_000 ? "\n\n（预览到此，保存后可查看完整文件。）" : "")
    }
}

struct ClassroomMaterialView: View {
    let source: URL
    @Environment(\.dismiss) private var dismiss
    @State private var file: URL?
    @State private var text: String?
    @State private var error: String?
    @State private var saving = false
    @State private var attempt = 0
    var body: some View {
        NavigationStack {
            Group {
                if let file {
                    if let text {
                        ClassroomMaterialText(text: text)
                    } else if file.pathExtension.lowercased() != "zip", QLPreviewController.canPreview(file as NSURL) {
                        FilePreview(url: file)
                    } else {
                        ContentUnavailableView(file.lastPathComponent, systemImage: "doc.zipper",
                            description: Text("保存到「文件」后，可用兼容的应用打开或解压。"))
                    }
                } else if let error {
                    ContentUnavailableView { Label("资料暂时无法打开", systemImage: "doc.badge.ellipsis") }
                    description: { Text(error) }
                    actions: { Button("重试") { attempt += 1 }.buttonStyle(.borderedProminent) }
                } else { ProgressView("正在打开资料…") }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle(file?.lastPathComponent ?? source.lastPathComponent).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.accessibilityIdentifier("classroom-file-close") } }
                .safeAreaInset(edge: .bottom) {
                    if let file {
                        VStack(spacing: 8) {
                            if file.pathExtension == "ipynb" { Text("实验笔记本 · 运行需要支持 Jupyter 的环境").font(.caption).foregroundStyle(.secondary) }
                            Button { saving = true } label: { Label("保存到文件", systemImage: "folder.badge.plus").frame(maxWidth: .infinity).padding(8) }
                                .buttonStyle(.borderedProminent).foregroundStyle(Color.expeditionNight).accessibilityIdentifier("classroom-file-save")
                        }.padding(16).background(.bar)
                    }
                }
        }.task(id: attempt) {
            error = nil
            do {
                let result = try await ClassroomMaterial.prepare(source)
                guard !Task.isCancelled else { return }
                text = ClassroomMaterial.textPreview(result); file = result
            } catch is CancellationError {} catch { self.error = (error as? LocalizedError)?.errorDescription ?? ClassroomMaterialError.unavailable.localizedDescription }
        }.sheet(isPresented: $saving) { if let file { SaveClassroomFile(url: file) } }
    }
}

// A native text view lays out long notebooks incrementally at the sheet's actual width.
// A single SwiftUI Text in an unbounded two-axis ScrollView can render these files blank.
private struct ClassroomMaterialText: UIViewRepresentable {
    let text: String
    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.backgroundColor = .clear
        view.textColor = .label
        view.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: .monospacedSystemFont(ofSize: 17, weight: .regular))
        view.adjustsFontForContentSizeCategory = true
        view.textContainerInset = UIEdgeInsets(top: 20, left: 20, bottom: 24, right: 20)
        view.textContainer.widthTracksTextView = true
        view.textContainer.lineBreakMode = .byWordWrapping
        view.accessibilityIdentifier = "classroom-file-content"
        return view
    }
    func updateUIView(_ view: UITextView, context: Context) {
        if view.text != text { view.text = text; view.setContentOffset(.zero, animated: false) }
    }
}

struct SaveClassroomFile: UIViewControllerRepresentable {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    func makeCoordinator() -> Coordinator { Coordinator { dismiss() } }
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
        if let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            let directory = documents.appendingPathComponent("课堂资料", isDirectory: true)
            try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            picker.directoryURL = directory
        }
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIDocumentPickerViewController, context: Context) {}
    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let close: () -> Void
        init(close: @escaping () -> Void) { self.close = close }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { close() }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { close() }
    }
}
