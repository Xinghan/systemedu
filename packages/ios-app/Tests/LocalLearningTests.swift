import XCTest
import WebKit
import SQLite3
@testable import SystemEdu

@MainActor
final class LocalLearningTests: XCTestCase {
    func testWebKitCanFetchBundledGLBWithSuccessfulStatus() async throws {
        let root = try XCTUnwrap(Bundle.main.url(forResource: "WebRuntime", withExtension: nil))
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(AssetSchemeHandler(root: root), forURLScheme: "systemedu")
        let view = WKWebView(frame: .zero, configuration: config)
        let loaded = expectation(description: "local page loaded")
        let observer = PageObserver(loaded: loaded)
        view.navigationDelegate = observer
        view.load(URLRequest(url: URL(string: "systemedu://bundle/index.html")!))
        await fulfillment(of: [loaded], timeout: 20)
        let result = try await view.callAsyncJavaScript("const r = await fetch('systemedu://bundle/mechanical-hand/mechanical-hand.glb'); const b = await r.arrayBuffer(); return { ok: r.ok, status: r.status, size: b.byteLength };", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["status"] as? Int, 200)
        XCTAssertEqual(result?["size"] as? Int, 4_364_628)
    }
    private func temporaryURL() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("learning.sqlite")
    }
    func testNewerDatabaseVersionIsPreservedAndRejected() throws {
        let url = temporaryURL()
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        var database: OpaquePointer?
        XCTAssertEqual(sqlite3_open(url.path, &database), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(database, "PRAGMA user_version=2", nil, nil, nil), SQLITE_OK)
        sqlite3_close(database)
        XCTAssertThrowsError(try LearningStore(url: url))
        XCTAssertEqual(sqlite3_open(url.path, &database), SQLITE_OK)
        defer { sqlite3_close(database) }
        var statement: OpaquePointer?
        sqlite3_prepare_v2(database, "PRAGMA user_version", -1, &statement, nil)
        defer { sqlite3_finalize(statement) }
        XCTAssertEqual(sqlite3_step(statement), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int(statement, 0), 2)
    }
    func testRecordSurvivesReopenAndOwnersStaySeparate() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        var original: LearningStore? = try LearningStore(url: url, owner: "guest")
        try original!.save(.hand, state: ["opposition": 0.72, "commands": ["index": 0.8]])
        original = nil
        let reopened = try LearningStore(url: url, owner: "guest")
        XCTAssertEqual(reopened.load(.hand)?["opposition"] as? Double, 0.72)
        let other = try LearningStore(url: url, owner: "another-account")
        XCTAssertNil(other.load(.hand))
        try other.save(.hand, state: ["opposition": 0.1])
        XCTAssertEqual(try LearningStore(url: url, owner: "guest").load(.hand)?["opposition"] as? Double, 0.72)
    }
    func testOversizedRecordDoesNotOverwritePrevious() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let store = try LearningStore(url: url)
        try store.save(.driving, state: ["note": "已保存"])
        XCTAssertThrowsError(try store.save(.driving, state: ["note": String(repeating: "a", count: 128_001)]))
        XCTAssertEqual(store.load(.driving)?["note"] as? String, "已保存")
        let export = try store.export(.driving)
        let data = try JSONSerialization.jsonObject(with: Data(contentsOf: export)) as! [String: Any]
        XCTAssertEqual(data["storage"] as? String, "local-preview")
    }
    func testBridgeRejectsWrongSessionActivityMethodAndType() throws {
        let body: [String: Any] = ["version": 1, "session": "session", "activity": "mars-landing", "request_id": "request", "method": "save", "state": ["time": 12]]
        XCTAssertEqual(try BridgeRequest(body: body, activity: .landing, session: "session").method, .save)
        XCTAssertThrowsError(try BridgeRequest(body: body, activity: .hand, session: "session"))
        XCTAssertThrowsError(try BridgeRequest(body: body, activity: .landing, session: "stale"))
        for (key, value) in [("method", "execute" as Any), ("version", true as Any), ("state", [] as Any), ("url", "file:///etc/passwd" as Any)] {
            var invalid = body; invalid[key] = value
            XCTAssertThrowsError(try BridgeRequest(body: invalid, activity: .landing, session: "session"))
        }
    }
    func testAssetsCannotEscapeBundleThroughPathsOrSymlinks() throws {
        let root = temporaryURL().deletingLastPathComponent()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try Data("ok".utf8).write(to: root.appendingPathComponent("index.html"))
        XCTAssertEqual(try AssetSchemeHandler.resolve(URL(string: "systemedu://bundle/index.html")!, root: root).lastPathComponent, "index.html")
        for value in ["systemedu://other/index.html", "file:///etc/passwd", "systemedu://bundle/%2e%2e/index.html", "systemedu://bundle/test.swift"] {
            XCTAssertThrowsError(try AssetSchemeHandler.resolve(URL(string: value)!, root: root))
        }
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("escape.json"), withDestinationURL: URL(fileURLWithPath: "/etc/hosts"))
        XCTAssertThrowsError(try AssetSchemeHandler.resolve(URL(string: "systemedu://bundle/escape.json")!, root: root))
    }
}

@MainActor
private final class PageObserver: NSObject, WKNavigationDelegate {
    let loaded: XCTestExpectation
    init(loaded: XCTestExpectation) { self.loaded = loaded }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded.fulfill() }
}
