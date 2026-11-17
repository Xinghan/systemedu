import Foundation
import WebKit
import UniformTypeIdentifiers

enum AssetError: Error { case forbidden, missing }

final class AssetSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root.resolvingSymlinksInPath(); super.init() }

    static func resolve(_ url: URL, root: URL) throws -> URL {
        guard url.scheme == "systemedu", url.host == "bundle", url.user == nil, url.port == nil else { throw AssetError.forbidden }
        let path = url.path
        guard !path.contains("\\"), !path.contains("\0"), !path.split(separator: "/").contains("..") else { throw AssetError.forbidden }
        let base = root.resolvingSymlinksInPath().standardizedFileURL
        let target = base.appendingPathComponent(String(path.dropFirst())).resolvingSymlinksInPath().standardizedFileURL
        guard target.path.hasPrefix(base.path + "/"), ["html","js","css","json","glb","png","woff2","woff","ttf","txt"].contains(target.pathExtension) else { throw AssetError.forbidden }
        guard FileManager.default.fileExists(atPath: target.path) else { throw AssetError.missing }
        return target
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        do {
            guard let url = urlSchemeTask.request.url, urlSchemeTask.request.httpMethod == "GET" else { throw AssetError.forbidden }
            let file = try Self.resolve(url, root: root)
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let special = ["js": "text/javascript", "css": "text/css", "glb": "model/gltf-binary", "woff2": "font/woff2"]
            let mime = special[file.pathExtension] ?? UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            // Fetch consumers (including GLTFLoader) need a real success status;
            // a plain URLResponse yields status 0 and response.ok == false.
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Content-Length": String(data.count), "Access-Control-Allow-Origin": "*"])!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Delivery is synchronous; there is no outstanding request after start returns.
    }
}
