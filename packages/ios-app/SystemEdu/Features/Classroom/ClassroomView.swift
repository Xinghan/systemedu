import SwiftUI
import SafariServices

struct SharedFile: Identifiable { let url: URL; var id: String { url.absoluteString } }

struct ClassroomView: View {
    let activity: LearningActivity
    @ObservedObject var store: LearningStore
    var crew: CrewProfile? = nil
    var embeddedInMission = false
    var onOpenActivity: ((LearningActivity) -> Void)? = nil
    var onMissionMap: (() -> Void)? = nil
    var missionContinueLabel: String? = nil
    var onAdvance: ((LearningActivity) throws -> Void)? = nil
    var onImmersiveChange: (Bool) -> Void = { _ in }
    @State private var immersive = false
    @State private var export: SharedFile?
    @State private var external: SharedFile?
    @State private var material: SharedFile?
    @State private var error: String?
    var body: some View {
        LearningWebView(activity: activity, store: store, crew: crew, missionContinueLabel: missionContinueLabel,
                        onExport: { export = SharedFile(url: $0) },
                        onExternal: { url in
                            if let activity = ContentCatalog.localActivity(for: url), let onOpenActivity { onOpenActivity(activity) }
                            else if url.host == "systeme.xin", url.path == "/mission/space", let onMissionMap { onMissionMap() }
                            else { external = SharedFile(url: url) }
                        },
                        onError: { error = $0 }, onFile: { url in
                            if UIDevice.current.userInterfaceIdiom == .pad { material = SharedFile(url: url) }
                            else if url.scheme == "https" { external = SharedFile(url: url) }
                            else { export = SharedFile(url: url) }
                        }, onAdvance: onAdvance, onImmersiveChange: { value in immersive = value; onImmersiveChange(value) })
            .navigationTitle(activity.title).navigationBarTitleDisplayMode(.inline)
            .toolbar(immersive || embeddedInMission ? .hidden : .visible, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
            .sheet(item: $export) { ShareSheet(url: $0.url) }
            .sheet(item: $external) { BrowserSheet(url: $0.url) }
            .sheet(item: $material) { ClassroomMaterialView(source: $0.url) }
            .alert("课堂提示", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") { error = nil } } message: { Text(error ?? "") }
    }
}
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
struct BrowserSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
