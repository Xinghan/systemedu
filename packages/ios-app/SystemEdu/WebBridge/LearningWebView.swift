import SwiftUI
import WebKit

struct LearningWebView: UIViewRepresentable {
    let activity: LearningActivity
    let store: LearningStore
    let onExport: (URL) -> Void
    let onExternal: (URL) -> Void
    let onError: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(activity: activity, store: store, onExport: onExport, onExternal: onExternal, onError: onError) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        if let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil) {
            configuration.setURLSchemeHandler(AssetSchemeHandler(root: root), forURLScheme: "systemedu")
        }
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "learning")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false; view.backgroundColor = UIColor(Color.paper)
        view.scrollView.backgroundColor = UIColor(Color.paper)
        // The classroom owns its viewport. Only focused reading cards and sheets scroll.
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.navigationDelegate = context.coordinator; view.uiDelegate = context.coordinator
        view.accessibilityIdentifier = "learning-webview"
        #if DEBUG
        view.isInspectable = true
        #endif
        let url = URL(string: "systemedu://bundle/index.html?activity=\(activity.rawValue)&session=\(context.coordinator.session)")!
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.active = false
        uiView.stopLoading(); uiView.navigationDelegate = nil; uiView.uiDelegate = nil
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "learning", contentWorld: .page)
        uiView.loadHTMLString("", baseURL: nil)
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate {
        let session = UUID().uuidString
        let activity: LearningActivity
        let store: LearningStore
        let onExport: (URL) -> Void
        let onExternal: (URL) -> Void
        let onError: (String) -> Void
        var active = true
        init(activity: LearningActivity, store: LearningStore, onExport: @escaping (URL) -> Void, onExternal: @escaping (URL) -> Void, onError: @escaping (String) -> Void) {
            self.activity = activity; self.store = store; self.onExport = onExport; self.onExternal = onExternal; self.onError = onError
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            do {
                guard active, message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
                      url.scheme == "systemedu", url.host == "bundle", url.path == "/index.html" else { throw AssetError.forbidden }
                let request = try BridgeRequest(body: message.body, activity: activity, session: session)
                switch request.method {
                case .load: replyHandler((store.load(activity) as Any?) ?? NSNull(), nil)
                case .save:
                    let saved = try store.save(activity, state: request.state!)
                    replyHandler(["saved_at": ISO8601DateFormatter().string(from: saved)], nil)
                case .export:
                    let url = try store.export(activity); onExport(url); replyHandler(["exported": true], nil)
                }
            } catch { replyHandler(nil, error.localizedDescription) }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "systemedu", url.host == "bundle", url.path == "/index.html", navigationAction.targetFrame?.isMainFrame == true {
                decisionHandler(.allow); return
            }
            if navigationAction.navigationType == .linkActivated, url.scheme == "https" { onExternal(url) }
            decisionHandler(.cancel)
        }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { onError("课堂进程已停止。已保存的记录仍在，可以返回后重新打开。") }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { onError("课堂加载失败，请返回后重试。") }
    }
}
