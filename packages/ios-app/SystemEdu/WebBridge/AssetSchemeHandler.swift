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
        guard target.path.hasPrefix(base.path + "/"), ["html","js","css","json","glb","gltf","bin","wasm","png","jpg","jpeg","webp","svg","woff2","woff","ttf","txt","md","mp3","m4a","wav","mp4","vtt","pdf","csv","ipynb","py","scad","stl","zip"].contains(target.pathExtension) else { throw AssetError.forbidden }
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
            var headers = ["Content-Type": mime, "Content-Length": String(data.count), "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes"]
            var payload = data, status = 200
            if let range = try Self.byteRange(urlSchemeTask.request.value(forHTTPHeaderField: "Range"), count: data.count) {
                payload = data.subdata(in: range); status = 206
                headers["Content-Range"] = "bytes \(range.lowerBound)-\(range.upperBound - 1)/\(data.count)"
                headers["Content-Length"] = String(payload.count)
            }
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(payload); urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    static func byteRange(_ header: String?, count: Int) throws -> Range<Int>? {
        guard let header else { return nil }
        guard count > 0, header.hasPrefix("bytes="), !header.contains(",") else { throw AssetError.forbidden }
        let parts = header.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2 else { throw AssetError.forbidden }
        if parts[0].isEmpty {
            guard let suffix = Int(parts[1]), suffix > 0 else { throw AssetError.forbidden }
            return max(0, count - suffix)..<count
        }
        guard let start = Int(parts[0]), start >= 0, start < count else { throw AssetError.forbidden }
        let end: Int
        if parts[1].isEmpty { end = count - 1 }
        else { guard let requested = Int(parts[1]), requested >= start else { throw AssetError.forbidden }; end = min(requested, count - 1) }
        return start..<(end + 1)
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Delivery is synchronous; there is no outstanding request after start returns.
    }
}
