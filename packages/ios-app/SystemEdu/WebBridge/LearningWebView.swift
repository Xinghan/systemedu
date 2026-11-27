import SwiftUI
import WebKit

struct LearningWebView: UIViewRepresentable {
    let activity: LearningActivity
    let store: LearningStore
    var crew: CrewProfile? = nil
    var missionContinueLabel: String? = nil
    let onExport: (URL) -> Void
    let onExternal: (URL) -> Void
    let onError: (String) -> Void
    var onFile: ((URL) -> Void)? = nil
    var onAdvance: ((LearningActivity) throws -> Void)? = nil
    var onImmersiveChange: (Bool) -> Void = { _ in }

    func makeCoordinator() -> Coordinator { Coordinator(activity: activity, store: store, onExport: onExport, onExternal: onExternal, onError: onError, onFile: onFile, onAdvance: onAdvance, onImmersiveChange: onImmersiveChange) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        if let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil) {
            configuration.setURLSchemeHandler(AssetSchemeHandler(root: root), forURLScheme: "systemedu")
        }
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "learning")
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "classroomPresentation")
        if let crew, let script = CrewClassroomIdentity.script(crew) {
            configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        if onAdvance != nil, let missionContinueLabel,
           let data = try? JSONSerialization.data(withJSONObject: ["continueLabel": missionContinueLabel]),
           let json = String(data: data, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: "window.__systemeduMissionNavigation = Object.freeze(" + json + ");", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let view = WKWebView(frame: .zero, configuration: configuration)
        let canvas = UIDevice.current.userInterfaceIdiom == .pad ? Color.expeditionNight : Color.paper
        view.isOpaque = false; view.backgroundColor = UIColor(canvas)
        view.scrollView.backgroundColor = UIColor(canvas)
        // The classroom owns its viewport. Only focused reading cards and sheets scroll.
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.navigationDelegate = context.coordinator; view.uiDelegate = context.coordinator
        view.accessibilityIdentifier = "learning-webview"
        #if DEBUG
        view.isInspectable = true
        #endif
        let presentation = UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone"
        let url = URL(string: "systemedu://bundle/index.html?activity=\(activity.rawValue)&session=\(context.coordinator.session)&presentation=\(presentation)")!
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.active = false
        uiView.stopLoading(); uiView.navigationDelegate = nil; uiView.uiDelegate = nil
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "learning", contentWorld: .page)
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomPresentation", contentWorld: .page)
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
        let onFile: (URL) -> Void
        let onAdvance: ((LearningActivity) throws -> Void)?
        let onImmersiveChange: (Bool) -> Void
        var active = true
        private var advanceRequested = false
        init(activity: LearningActivity, store: LearningStore, onExport: @escaping (URL) -> Void, onExternal: @escaping (URL) -> Void, onError: @escaping (String) -> Void, onFile: ((URL) -> Void)? = nil, onAdvance: ((LearningActivity) throws -> Void)? = nil, onImmersiveChange: @escaping (Bool) -> Void) {
            self.activity = activity; self.store = store; self.onExport = onExport; self.onExternal = onExternal; self.onError = onError
            self.onFile = onFile ?? onExport
            self.onAdvance = onAdvance; self.onImmersiveChange = onImmersiveChange
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            do {
                guard active, message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
                      url.scheme == "systemedu", url.host == "bundle", url.path == "/index.html" else { throw AssetError.forbidden }
                if message.name == "classroomPresentation" {
                    guard let body = message.body as? [String: Any], body.count == 3,
                          body["session"] as? String == session, body["activity"] as? String == activity.rawValue,
                          let immersive = body["immersive"] as? Bool else { throw AssetError.forbidden }
                    onImmersiveChange(immersive); replyHandler(["accepted": true], nil); return
                }
                let request = try BridgeRequest(body: message.body, activity: activity, session: session)
                switch request.method {
                case .load:
                    var state = store.load(activity) ?? [:]
                    state["reference_workspace"] = try store.missionReferences(excluding: activity)
                    replyHandler(state, nil)
                case .save:
                    let saved = try store.save(activity, state: request.state!)
                    replyHandler(["saved_at": ISO8601DateFormatter().string(from: saved)], nil)
                case .export:
                    let url = try store.export(activity); onExport(url); replyHandler(["exported": true], nil)
                case .advance:
                    try advanceOnce()
                    replyHandler(["advanced": true], nil)
                }
            } catch { replyHandler(nil, error.localizedDescription) }
        }
        // The mission rechecks the persisted completion and current activity.
        // A second message from the departing WebView cannot skip a lesson.
        func advanceOnce() throws {
            guard active, !advanceRequested, let onAdvance else { throw StoreError.invalidState }
            advanceRequested = true
            do { try onAdvance(activity) }
            catch { advanceRequested = false; throw error }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "systemedu", url.host == "bundle", url.path == "/index.html", navigationAction.targetFrame?.isMainFrame == true {
                decisionHandler(.allow); return
            }
            if navigationAction.targetFrame?.isMainFrame == false, ["about", "blob"].contains(url.scheme ?? "") { decisionHandler(.allow); return }
            if navigationAction.targetFrame?.isMainFrame == false, url.scheme == "systemedu", url.host == "bundle",
               navigationAction.navigationType != .linkActivated, !navigationAction.shouldPerformDownload {
                decisionHandler(.allow); return
            }
            if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil || navigationAction.shouldPerformDownload || url.scheme == "data" {
                openLink(url)
            }
            decisionHandler(.cancel)
        }
        // target="_blank" and scripted downloads need a native destination; never replace the lesson.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url { openLink(url) }
            return nil
        }
        func openLink(_ url: URL) {
            guard active else { return }
            if url.scheme == "data" {
                guard url.absoluteString.count < 17_000_000 else { onError("文件过大，请减小作品后再保存。"); return }
                let parts = url.absoluteString.components(separatedBy: "#")
                if let comma = parts[0].firstIndex(of: ","), parts[0][..<comma].hasSuffix(";base64"),
                   let data = Data(base64Encoded: String(parts[0][parts[0].index(after: comma)...])), data.count <= 12_000_000 {
                    let name = (parts.count > 1 ? parts[1].removingPercentEncoding : nil) ?? "experiment.json"
                    let clean = ClassroomMaterial.filename(name)
                    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                    do {
                        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                        let target = directory.appendingPathComponent(clean)
                        try data.write(to: target, options: .atomic); onFile(target)
                    } catch { onError("作品导出失败，请重试。") }
                } else { onError("这份文件暂时无法读取，请重试。") }
                return
            }
            if url.scheme == "systemedu", url.host == "bundle" {
                do {
                    guard let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil) else { throw AssetError.missing }
                    onFile(try AssetSchemeHandler.resolve(url, root: root))
                } catch { onError("资料“\(url.lastPathComponent)”暂时无法打开，请返回课堂后重试。") }
                return
            }
            if ClassroomMaterial.isRemoteFile(url) { onFile(url) }
            else if url.scheme == "https" { onExternal(url) }
        }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { onImmersiveChange(false); onError("课堂进程已停止。已保存的记录仍在，可以返回后重新打开。") }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { onImmersiveChange(false); onError("课堂加载失败，请返回后重试。") }
    }
}

enum CrewClassroomIdentity {
    static func payload(_ profile: CrewProfile) -> [String: String] {
        let portrait = (profile.avatarThumbnail ?? profile.avatar).flatMap { CrewImage.jpeg($0, side: 160) }
        return ["name": profile.name, "role": profile.role.title, "duty": profile.role.duty,
                "avatar": portrait.map { "data:image/jpeg;base64," + $0.base64EncodedString() } ?? profile.role.characterImagePath]
    }
    static func script(_ profile: CrewProfile) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: payload(profile)), let json = String(data: data, encoding: .utf8) else { return nil }
        // Main-frame presentation context only; never sent to save/export or placed in URLs.
        return "window.__systemeduCrew = Object.freeze(" + json + ");"
    }
}
