import XCTest
import WebKit
@testable import SystemEdu

@MainActor
final class ClassroomMaterialTests: XCTestCase {
    private func bundled(_ name: String) throws -> URL {
        let root = try XCTUnwrap(Bundle.main.url(forResource: "WebRuntime", withExtension: nil))
        return try AssetSchemeHandler.resolve(URL(string: "systemedu://bundle/content/assets/lightkurve-transit-detective/downloads/" + name)!, root: root)
    }
    func testOriginalCourseFilesStayIntactWhenPreparedForFilesApp() async throws {
        for name in ["junior-guide.ipynb", "kepler10-q3-validity-input.csv", "lightkurve-practice-kit.zip", "first-observation-card-template.html"] {
            let source = try bundled(name)
            let copy = try await ClassroomMaterial.prepare(source)
            defer { try? FileManager.default.removeItem(at: copy.deletingLastPathComponent()) }
            XCTAssertEqual(copy.lastPathComponent, name)
            XCTAssertEqual(try Data(contentsOf: source), try Data(contentsOf: copy))
            XCTAssertNotEqual(source, copy)
            if name.hasSuffix("ipynb") {
                let preview = try XCTUnwrap(ClassroomMaterial.textPreview(copy))
                XCTAssertFalse(preview.contains("\"nbformat\"")); XCTAssertFalse(preview.isEmpty)
            } else if name.hasSuffix("csv") {
                let preview = try XCTUnwrap(ClassroomMaterial.textPreview(copy))
                XCTAssertTrue(preview.hasPrefix("ROW_INDEX,CADENCENO,TIME_BKJD"))
                XCTAssertTrue(preview.contains("保存后可查看完整文件"))
                XCTAssertLessThan(preview.utf8.count, 30_000)
            }
        }
    }
    func testUnicodeFilenamesStayReadableAndCannotEscapeDestination() throws {
        XCTAssertEqual(ClassroomMaterial.filename("我的观测表.csv"), "我的观测表.csv")
        XCTAssertFalse(ClassroomMaterial.filename("../../资料\\表.csv").contains("/"))
        XCTAssertFalse(ClassroomMaterial.filename("../../资料\\表.csv").contains("\\"))
        XCTAssertEqual(ClassroomMaterial.filename(".."), "课堂资料")
        XCTAssertTrue(ClassroomMaterial.isRemoteFile(URL(string: "https://example.org/reference.PDF?download=1")!))
        XCTAssertFalse(ClassroomMaterial.isRemoteFile(URL(string: "https://example.org/tutorial.html")!))
        XCTAssertFalse(ClassroomMaterial.isRemoteFile(URL(string: "http://example.org/data.csv")!))
        XCTAssertEqual(Bundle.main.object(forInfoDictionaryKey: "UIFileSharingEnabled") as? Bool, true)
        XCTAssertEqual(Bundle.main.object(forInfoDictionaryKey: "LSSupportsOpeningDocumentsInPlace") as? Bool, true)
        let documents = try XCTUnwrap(FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first)
        XCTAssertFalse(LearningStore.defaultURL.path.hasPrefix(documents.path + "/"))
    }
    func testLiveAuthoredReferencePDFCanBeDownloaded() async throws {
        guard ProcessInfo.processInfo.environment["SYSTEMEDU_LIVE_FILE_TEST"] == "1" else { throw XCTSkip("Opt-in authored HTTPS reference") }
        let file = try await ClassroomMaterial.prepare(URL(string: "https://archive.stsci.edu/kepler/manuals/archive_manual.pdf")!)
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        XCTAssertEqual(file.pathExtension.lowercased(), "pdf")
        XCTAssertEqual(try Data(contentsOf: file).prefix(4), Data("%PDF".utf8))
    }
    func testMaterialRoutingReportsMissingFilesAndKeepsWebReferencesSeparate() throws {
        let database = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("test.sqlite")
        defer { try? FileManager.default.removeItem(at: database.deletingLastPathComponent()) }
        var files: [URL] = [], references: [URL] = [], errors: [String] = []
        let coordinator = LearningWebView.Coordinator(activity: .hand, store: try LearningStore(url: database), onExport: { _ in XCTFail("Not a record export") },
            onExternal: { references.append($0) }, onError: { errors.append($0) }, onFile: { files.append($0) }, onImmersiveChange: { _ in })
        coordinator.openLink(URL(string: "systemedu://bundle/content/assets/lightkurve-transit-detective/downloads/junior-guide.ipynb")!)
        coordinator.openLink(URL(string: "https://example.org/reference.pdf")!)
        coordinator.openLink(URL(string: "https://example.org/tutorial")!)
        coordinator.openLink(URL(string: "systemedu://bundle/content/assets/missing.csv")!)
        let name = try XCTUnwrap("我的观测表.csv".addingPercentEncoding(withAllowedCharacters: .urlFragmentAllowed))
        coordinator.openLink(URL(string: "data:text/csv;base64," + Data("time,flux\n1,2".utf8).base64EncodedString() + "#" + name)!)
        XCTAssertEqual(files.count, 3); XCTAssertEqual(references.count, 1); XCTAssertEqual(errors.count, 1)
        let generated = try XCTUnwrap(files.last)
        defer { try? FileManager.default.removeItem(at: generated.deletingLastPathComponent()) }
        XCTAssertEqual(generated.lastPathComponent, "我的观测表.csv")
        XCTAssertEqual(try String(contentsOf: generated, encoding: .utf8), "time,flux\n1,2")
        coordinator.active = false
        coordinator.openLink(URL(string: "https://example.org/another.pdf")!)
        XCTAssertEqual(files.count, 3)
    }
}
