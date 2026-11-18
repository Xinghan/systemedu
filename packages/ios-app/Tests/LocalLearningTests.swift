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
        XCTAssertThrowsError(try store.save(.driving, state: ["note": String(repeating: "a", count: 512_001)]))
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
    func testCourseVersionsAndLegacyPreviewRecordsStayIndependent() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let first = LearningActivity(rawValue: "course:lightkurve-transit-detective:0.2.0:M01")!
        let newer = LearningActivity(rawValue: "course:lightkurve-transit-detective:0.3.0:M01")!
        let store = try LearningStore(url: url)
        try store.save(first, state: ["note": "旧版判断", "frames": ["model": ["state": "{angles:30}"]]])
        try store.save(.driving, state: ["note": "原有导览"])
        XCTAssertNil(store.load(newer))
        let reopened = try LearningStore(url: url)
        XCTAssertEqual(reopened.load(first)?["note"] as? String, "旧版判断")
        XCTAssertEqual(reopened.load(.driving)?["note"] as? String, "原有导览")
        XCTAssertNotNil(try reopened.export(first))
    }
    func testWorkspaceContinuesAcrossNodesWithoutMixingVersionsOrOwners() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let first = LearningActivity(rawValue: "course:build-a-solar-tracker:1.0:M01")!
        let second = LearningActivity(rawValue: "course:build-a-solar-tracker:1.0:M02")!
        let changed = LearningActivity(rawValue: "course:build-a-solar-tracker:2.0:M02")!
        let store = try LearningStore(url: url)
        try store.save(first, state: ["note": "只属于第一课", "shared_workspace": ["tracker": "angle=40"]])
        let restored = try LearningStore(url: url)
        XCTAssertNil(restored.load(second)?["note"])
        XCTAssertEqual((restored.load(second)?["shared_workspace"] as? [String: String])?["tracker"], "angle=40")
        XCTAssertNil(restored.load(changed))
        XCTAssertNil(try LearningStore(url: url, owner: "other").load(second))
        XCTAssertEqual(restored.records.count, 1)
    }
    func testNarrationAndVideoRangesSupportSeeking() throws {
        XCTAssertEqual(try AssetSchemeHandler.byteRange("bytes=0-1", count: 100), 0..<2)
        XCTAssertEqual(try AssetSchemeHandler.byteRange("bytes=20-", count: 100), 20..<100)
        XCTAssertEqual(try AssetSchemeHandler.byteRange("bytes=-10", count: 100), 90..<100)
        XCTAssertEqual(try AssetSchemeHandler.byteRange("bytes=20-9999", count: 100), 20..<100)
        XCTAssertThrowsError(try AssetSchemeHandler.byteRange("bytes=100-", count: 100))
        XCTAssertThrowsError(try AssetSchemeHandler.byteRange("bytes=-0", count: 100))
    }
    func testFullCatalogAndNodeFilesAreBundled() throws {
        let catalog = try ContentCatalog.result.get()
        XCTAssertEqual(catalog.courses.count, 58)
        XCTAssertEqual(catalog.courses.flatMap(\.modules).count, 843)
        let root = try XCTUnwrap(Bundle.main.url(forResource: "WebRuntime", withExtension: nil))
        for node in catalog.courses.flatMap(\.modules) {
            XCTAssertNoThrow(try AssetSchemeHandler.resolve(URL(string: "systemedu://bundle" + node.path)!, root: root))
        }
    }
    func testEveryProjectCoverDecodesOffline() throws {
        for course in try ContentCatalog.result.get().courses {
            let url = try XCTUnwrap(course.coverURL, course.id)
            let image = try XCTUnwrap(CourseImageCache.load(url), course.id)
            XCTAssertGreaterThan(image.size.width, 0, course.id)
            XCTAssertFalse(course.summary?.isEmpty ?? true, course.id)
        }
    }
    func testCourseResumeUsesOnlyItsOwnVersionAndAdvancesCompletedNodes() throws {
        let course = try XCTUnwrap(ContentCatalog.current?.courses.first { $0.id == "lightkurve-transit-detective" })
        let first = course.modules[0], second = course.modules[1]
        let unrelated = LocalRecord(activity: .hand, state: [:], updatedAt: .now)
        let old = LocalRecord(activity: LearningActivity(rawValue: "course:lightkurve-transit-detective:0.1:M32")!, state: [:], updatedAt: .now)
        XCTAssertEqual(course.resumeNode(in: [unrelated, old])?.id, first.id)
        let partial = LocalRecord(activity: first.activity, state: ["page": 4], updatedAt: .now)
        XCTAssertEqual(course.resumeNode(in: [unrelated, partial])?.id, first.id)
        let finished = LocalRecord(activity: first.activity, state: ["self_completed": true], updatedAt: .now)
        XCTAssertEqual(course.resumeNode(in: [finished, old])?.id, second.id)
        XCTAssertEqual(course.completedCount(in: [finished, old]), 1)
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

    func testRevisedCourseKeepsOldRecordsWithoutCountingThemAsNewCompletion() throws {
        let course = try XCTUnwrap(ContentCatalog.current?.courses.first { $0.id == "ai-ant-ethologist" })
        XCTAssertEqual(course.contentRevision, "20261118")
        let first = course.modules[0]
        let old = LocalRecord(activity: first.activity, state: ["self_completed": true, "note": "原笔记"], updatedAt: .now)
        XCTAssertEqual(course.completedCount(in: [old]), 0)
        XCTAssertEqual(course.resumeNode(in: [old])?.id, first.id)
        XCTAssertEqual(old.state["note"] as? String, "原笔记")
        let revised = LocalRecord(activity: first.activity, state: ["self_completed": true, "content_revision": "20261118"], updatedAt: .now)
        XCTAssertEqual(course.completedCount(in: [revised]), 1)
        XCTAssertEqual(course.resumeNode(in: [revised])?.id, course.modules[1].id)
    }
}

@MainActor
private final class PageObserver: NSObject, WKNavigationDelegate {
    let loaded: XCTestExpectation
    init(loaded: XCTestExpectation) { self.loaded = loaded }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded.fulfill() }
}
