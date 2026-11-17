import SwiftUI
import SafariServices

struct SharedFile: Identifiable { let url: URL; var id: String { url.absoluteString } }

struct ClassroomView: View {
    let activity: LearningActivity
    @ObservedObject var store: LearningStore
    @State private var export: SharedFile?
    @State private var external: SharedFile?
    @State private var error: String?
    var body: some View {
        LearningWebView(activity: activity, store: store,
                        onExport: { export = SharedFile(url: $0) },
                        onExternal: { external = SharedFile(url: $0) },
                        onError: { error = $0 })
            .navigationTitle(activity.title).navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Image(systemName: "internaldrive").foregroundStyle(Color.forest).accessibilityLabel("本地课堂，离线可用") } }
            .sheet(item: $export) { ShareSheet(url: $0.url) }
            .sheet(item: $external) { BrowserSheet(url: $0.url) }
            .alert("课堂暂时中断", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") { error = nil } } message: { Text(error ?? "") }
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
