import SwiftUI
import UniformTypeIdentifiers
import QuickLook

struct ExpeditionDeliveryView: View {
    let story: Expedition
    let chapter: ExpeditionChapter
    let mission: TabletMission
    let profile: CrewProfile
    @ObservedObject var store: LearningStore
    let onBack: () -> Void
    let onSubmit: (ExpeditionReceipt) -> Void
    @State private var draft = ExpeditionDraft()
    @State private var ready = false
    @State private var submitting = false
    @State private var importing = false
    @State private var requirement: ExpeditionRequirement?
    @State private var error: String?
    @State private var preview: SharedFile?
    private var missing: [String] { draft.missing(chapter) }
    private var stepsDone: Bool { chapter.isReadyForDelivery(mission: mission, store: store) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .center, spacing: 20) {
                    CrewAvatar(profile: profile, size: 82)
                    VStack(alignment: .leading, spacing: 7) {
                        Text("\(profile.name)的第 \((story.chapters.firstIndex { $0.id == chapter.id } ?? 0) + 1) 份作品").font(.caption.bold()).foregroundStyle(Color.expeditionGold)
                        Text(chapter.delivery.title).font(.largeTitle.bold()).accessibilityIdentifier("expedition-delivery-title")
                        Text("把亲手完成的成果收好，带进下一章。").foregroundStyle(.white.opacity(0.65))
                    }
                }
                ForEach(chapter.delivery.evidence) { item in
                    VStack(alignment: .leading, spacing: 13) {
                        HStack { Image(systemName: draft.artifacts.contains { $0.requirement == item.id } ? "checkmark.circle.fill" : "circle.dashed").foregroundStyle(Color.expeditionGold); Text(item.title).font(.headline); Spacer() }
                        Text(item.instruction).font(.subheadline).foregroundStyle(.white.opacity(0.7)).lineSpacing(4)
                        if let artifact = draft.artifacts.first(where: { $0.requirement == item.id }) {
                            ExpeditionArtifactCard(artifact: artifact) { open(artifact) }
                        }
                        if chapter.id != "first-contact" {
                            Button(draft.artifacts.contains { $0.requirement == item.id } ? "替换这份材料" : "收进作品文件") { requirement = item; importing = true }.buttonStyle(.bordered).accessibilityIdentifier("evidence-import-" + item.id)
                            Text("可收图像、PDF、数据、程序或压缩包；每份最多 8 MB。课堂记录也会随交付一并留存。").font(.caption2).foregroundStyle(.white.opacity(0.5))
                        } else if draft.artifacts.isEmpty {
                            Label("还没有拍摄记录。返回课堂，调整望远镜并拍下你的照片。", systemImage: "camera").font(.callout).foregroundStyle(Color.expeditionGold)
                        }
                    }.padding(22).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 18))
                }
                ForEach(chapter.delivery.fields) { field in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(field.title).font(.headline)
                        Text(field.prompt).font(.subheadline).foregroundStyle(.white.opacity(0.65))
                        TextField("写下你的判断", text: Binding(get: { draft.explanations[field.id] ?? "" }, set: { draft.explanations[field.id] = String($0.prefix(4000)); draft.checks = []; save() }), axis: .vertical)
                            .lineLimit(3...8).padding(15).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("evidence-note-" + field.id)
                    }
                }
                VStack(alignment: .leading, spacing: 14) {
                    Text("打开自己的作品，对照检查").font(.headline)
                    ForEach(Array(chapter.delivery.checks.enumerated()), id: \.offset) { index, check in
                        Button {
                            if draft.checks.contains(index) { draft.checks.remove(index) } else { draft.checks.insert(index) }
                            save()
                        } label: {
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: draft.checks.contains(index) ? "checkmark.square.fill" : "square").font(.title2).foregroundStyle(Color.expeditionGold)
                                Text(check).font(.subheadline).lineSpacing(4).multilineTextAlignment(.leading).foregroundStyle(.white)
                                Spacer(minLength: 0)
                            }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(draft.artifacts.count < chapter.delivery.evidence.count)
                            .accessibilityValue(draft.checks.contains(index) ? "已核对" : "未核对").accessibilityIdentifier("evidence-check-\(index)")
                    }
                    Text(chapter.delivery.boundary).font(.caption).foregroundStyle(.white.opacity(0.6)).lineSpacing(4)
                }.padding(22).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 18))
                if !missing.isEmpty { Text("还差：" + missing.joined(separator: "、")).font(.callout).foregroundStyle(Color.expeditionGold).accessibilityIdentifier("evidence-missing") }
                if !stepsDone { Text("先完成本章的学习与操作步骤，再交付作品。").font(.callout).foregroundStyle(Color.expeditionGold) }
                Button(action: submit) {
                    HStack { Image(systemName: "tray.and.arrow.down.fill"); Text("署名入档，完成本章任务"); Spacer(); Image(systemName: "arrow.right") }.font(.headline).padding(20).background(Color.expeditionGold, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(Color.expeditionNight)
                }.buttonStyle(.plain).disabled(!ready || submitting || !missing.isEmpty || !stepsDone).opacity(!missing.isEmpty || !stepsDone ? 0.45 : 1).accessibilityIdentifier("expedition-submit")
                Text("入档保留此刻的副本；材料齐备和自检不代替教师评阅。").font(.caption).foregroundStyle(.white.opacity(0.55))
            }.padding(30).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }.background(Color.expeditionNight).foregroundStyle(.white).tint(.expeditionGold)
            .navigationTitle("本章作品").navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
            .navigationBarBackButtonHidden()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: returnToLesson) {
                        HStack(spacing: 8) { Image(systemName: "chevron.left"); Text("返回上一节") }.fixedSize()
                    }
                        .accessibilityIdentifier("expedition-delivery-back")
                }
            }
            .task { load() }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
                do {
                    guard let url = try result.get().first, let requirement else { return }
                    let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size > 0, size <= 8_000_000 else { throw StoreError.invalidState }
                    let data = try Data(contentsOf: url)
                    try draft.add(ExpeditionArtifact(requirement: requirement.id, filename: url.lastPathComponent, data: data, origin: "learner-import", createdAt: Date()))
                    save()
                } catch { self.error = error.localizedDescription }
            }
            .sheet(item: $preview) { FilePreview(url: $0.url) }
            .alert("作品提示", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private func returnToLesson() {
        do {
            if ready { try store.saveDocument(draft, key: story.draftKey(chapter)) }
            onBack()
        } catch { self.error = error.localizedDescription }
    }
    private func load() {
        do {
            draft = (try store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
            if let photo = chapter.capturedPhoto(mission: mission, store: store), draft.artifacts.first(where: { $0.requirement == "photo" })?.data != photo.data { try draft.add(photo) }
            ready = true; save()
        } catch { self.error = error.localizedDescription }
    }
    private func save() { guard ready else { return }; do { try store.saveDocument(draft, key: story.draftKey(chapter)) } catch { self.error = error.localizedDescription } }
    private func open(_ artifact: ExpeditionArtifact) { do { preview = SharedFile(url: try artifact.previewURL()) } catch { self.error = error.localizedDescription } }
    private func submit() {
        guard ready, !submitting, missing.isEmpty, stepsDone else { return }
        submitting = true
        do {
            let receipt = ExpeditionReceipt(storyId: story.id, chapterId: chapter.id, title: chapter.delivery.title, profile: profile, work: draft,
                sources: try chapter.sources(mission: mission, store: store), submittedAt: Date(), reviewStatus: "材料已收齐 · 学生已自检 · 内容待评阅")
            try store.saveDocument(receipt, key: story.receiptKey(chapter), immutable: true)
            onSubmit(receipt)
        } catch { submitting = false; self.error = error.localizedDescription }
    }
}

extension ExpeditionArtifact {
    var photoData: Data? {
        if UIImage(data: data) != nil { return data }
        guard let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let image = value["image"] as? String,
              image.hasPrefix("data:image/jpeg;base64,") else { return nil }
        return Data(base64Encoded: String(image.dropFirst("data:image/jpeg;base64,".count)))
    }
    func previewURL() throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("expedition-previews", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let embeddedPhoto = filename.hasSuffix(".json") ? photoData : nil
        let name = embeddedPhoto == nil ? URL(fileURLWithPath: filename).lastPathComponent : "星球照片.jpg"
        let url = folder.appendingPathComponent(id + "-" + name)
        try (embeddedPhoto ?? data).write(to: url, options: [.atomic, .completeFileProtection]); return url
    }
}
struct ExpeditionArtifactCard: View {
    let artifact: ExpeditionArtifact
    let onOpen: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let bytes = artifact.photoData, let image = UIImage(data: bytes) {
                Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 330).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("expedition-work-image")
            }
            Button(action: onOpen) { HStack { Image(systemName: "doc.richtext"); Text(artifact.filename).lineLimit(2); Spacer(); Text("打开"); Image(systemName: "arrow.up.right") } }.font(.subheadline)
            Text("\(ByteCountFormatter.string(fromByteCount: Int64(artifact.data.count), countStyle: .file)) · \(artifact.origin == "learner-import" ? "你提供的作品文件" : "课堂操作记录")").font(.caption).foregroundStyle(.white.opacity(0.55))
        }
    }
}

struct ExpeditionReceiptView: View {
    let receipt: ExpeditionReceipt
    let handoff: String
    let onContinue: (() -> Void)?
    var completionFilm: TabletFilm? = nil
    var autoPlayCompletion = false
    var nextChapterTitle: String? = nil
    @State private var preview: SharedFile?
    @State private var export: SharedFile?
    @State private var error: String?
    @State private var presentedFilm: TabletFilm?
    @State private var autoPlayStarted = false
    @State private var continueAfterFilm = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 22) {
                    CrewAvatar(profile: receipt.profile, size: 100)
                    VStack(alignment: .leading, spacing: 10) {
                        Label("这一章，你有了自己的成果", systemImage: "checkmark.seal.fill").font(.subheadline).foregroundStyle(Color.expeditionGold)
                        Text(receipt.title).font(.largeTitle.bold())
                        Text("\(receipt.profile.name) · \(receipt.profile.role.title)").font(.title3)
                        Text(receipt.submittedAt, format: .dateTime.year().month().day().hour().minute()).font(.caption).foregroundStyle(.white.opacity(0.5))
                    }
                }
                if let completionFilm {
                    Button { presentedFilm = completionFilm } label: { Label("重看林岚的阶段回信", systemImage: "play.rectangle.fill") }
                        .buttonStyle(.bordered).accessibilityIdentifier("expedition-replay-completion")
                }
                ForEach(receipt.work.artifacts) { artifact in
                    ExpeditionArtifactCard(artifact: artifact) { do { preview = SharedFile(url: try artifact.previewURL()) } catch { self.error = error.localizedDescription } }
                        .padding(22).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 18))
                }
                ForEach(receipt.work.explanations.keys.sorted(), id: \.self) { key in Text(receipt.work.explanations[key] ?? "").lineSpacing(5).padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 16)) }
                Text(receipt.reviewStatus).font(.caption).foregroundStyle(.white.opacity(0.65))
                if !handoff.isEmpty { HStack(alignment: .top, spacing: 16) { Image(systemName: "arrow.turn.down.right").font(.title2).foregroundStyle(Color.expeditionGold); Text(handoff).font(.title3).lineSpacing(6) }.padding(.vertical, 12) }
                if let onContinue { Button(action: onContinue) { HStack { Text(nextChapterTitle.map { "进入下一章 · " + $0 } ?? "完成远航，查看总档案"); Spacer(); Image(systemName: "arrow.right") }.font(.headline).padding(20).foregroundStyle(Color.expeditionNight).background(Color.expeditionGold, in: RoundedRectangle(cornerRadius: 16)) }.buttonStyle(.plain).accessibilityIdentifier("expedition-next-chapter") }
                Button { exportReceipt() } label: { Label("导出这份作品与原始记录", systemImage: "square.and.arrow.up") }.font(.subheadline)
                Text("你的署名、作品和课堂记录已随本章归档。").font(.caption).foregroundStyle(.white.opacity(0.5)).lineSpacing(4)
            }.padding(32).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }.background(Color.expeditionNight).foregroundStyle(.white).tint(.expeditionGold)
            .sheet(item: $preview) { FilePreview(url: $0.url) }.sheet(item: $export) { ShareSheet(url: $0.url) }
            .task(id: receipt.id) {
                guard autoPlayCompletion, !autoPlayStarted, let completionFilm else { return }
                // Let the completed delivery screen finish returning to the receipt before presenting.
                do { try await Task.sleep(for: .milliseconds(400)) } catch { return }
                // Navigation can cancel and restart this task. Only consume autoplay when presenting.
                guard !Task.isCancelled, !autoPlayStarted else { return }
                autoPlayStarted = true
                presentedFilm = completionFilm
            }
            .fullScreenCover(item: $presentedFilm, onDismiss: {
                if continueAfterFilm { continueAfterFilm = false; onContinue?() }
            }) { film in
                TabletFilmView(film: film, continueTitle: onContinue == nil ? "返回作品" : (nextChapterTitle.map { "进入「" + $0 + "」" } ?? "完成远航"),
                    context: "\(receipt.profile.name) · 「\(receipt.title)」已归档 · \(receipt.work.artifacts.count) 份材料") {
                        continueAfterFilm = onContinue != nil
                    }
            }
            .alert("作品提示", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private func exportReceipt() {
        do {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("远航作品-" + receipt.chapterId + ".json")
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(receipt).write(to: url, options: [.atomic, .completeFileProtection]); export = SharedFile(url: url)
        } catch { self.error = error.localizedDescription }
    }
}
struct FilePreview: UIViewControllerRepresentable {
    let url: URL
    func makeCoordinator() -> Coordinator { Coordinator(url) }
    func makeUIViewController(context: Context) -> QLPreviewController { let controller = QLPreviewController(); controller.dataSource = context.coordinator; return controller }
    func updateUIViewController(_ controller: QLPreviewController, context: Context) {}
    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL
        init(_ url: URL) { self.url = url }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { url as NSURL }
    }
}
