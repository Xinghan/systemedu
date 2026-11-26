import XCTest
import UIKit
@testable import SystemEdu

@MainActor
final class ExpeditionTests: XCTestCase {
    private func database() throws -> (LearningStore, URL) {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("learning.sqlite")
        return (try LearningStore(url: url), url)
    }
    func testLiveAvatarAdapterWithSyntheticBundledFixture() async throws {
        guard ProcessInfo.processInfo.environment["SYSTEMEDU_LIVE_AVATAR_TEST"] == "1" else { throw XCTSkip("Opt-in live provider integration") }
        let url = try XCTUnwrap(TabletMission.bundledURL("/mission/rover/engineer-1920.webp"))
        let input = try XCTUnwrap(CrewImage.jpeg(Data(contentsOf: url)))
        let result = try await AvatarService.generate(input)
        let image = try XCTUnwrap(UIImage(data: result))
        XCTAssertLessThanOrEqual(max(image.size.width, image.size.height), 640)
        XCTAssertNotEqual(result, input)
    }
    func testEveryOriginalNodeHasExactlyOneChapterAndEveryChapterHasAWorkProduct() throws {
        let story = try XCTUnwrap(Expedition.current), mission = try XCTUnwrap(TabletMission.current)
        let refs = story.chapters.flatMap(\.refs)
        XCTAssertEqual(refs.count, 120); XCTAssertEqual(Set(refs), Set(mission.allNodes.map(\.ref)))
        XCTAssertEqual(Set(refs).count, refs.count)
        XCTAssertEqual(Set(story.chapters.map(\.image)).count, 14)
        for chapter in story.chapters { XCTAssertFalse(chapter.delivery.evidence.isEmpty); XCTAssertFalse(chapter.delivery.checks.isEmpty); XCTAssertEqual(chapter.nodes(mission).count, chapter.refs.count) }
        XCTAssertEqual(story.films.count, 15)
        let overview = try XCTUnwrap(story.overview)
        let mapped = overview.acts.flatMap(\.chapters)
        XCTAssertEqual(Set(mapped), Set(story.chapters.map(\.id)))
        XCTAssertEqual(mapped.count, story.chapters.count)
        for chapter in story.chapters { XCTAssertEqual(chapter.actions?.count, 3) }
    }
    func testCustomPortraitReachesClassroomWithoutChangingStoredIdentity() throws {
        let role = try XCTUnwrap(Expedition.current?.roles[0])
        let input = UIGraphicsImageRenderer(size: CGSize(width: 640, height: 640)).jpegData(withCompressionQuality: 0.9) { context in UIColor.purple.setFill(); context.fill(CGRect(x: 0, y: 0, width: 640, height: 640)) }
        let profile = CrewProfile(name: "星禾\"\\测试", role: role, avatar: input)
        let payload = CrewClassroomIdentity.payload(profile)
        let encoded = try XCTUnwrap(payload["avatar"]?.split(separator: ",").last)
        let image = try XCTUnwrap(Data(base64Encoded: String(encoded)).flatMap(UIImage.init(data:)))
        XCTAssertEqual(image.size.width, 160)
        XCTAssertEqual(payload["name"], profile.name)
        XCTAssertEqual(profile.avatar, input)
        let script = try XCTUnwrap(CrewClassroomIdentity.script(profile))
        XCTAssertFalse(script.contains("localStorage"))
        XCTAssertEqual(CrewClassroomIdentity.payload(CrewProfile(name: "新队员", role: role, avatar: nil))["avatar"], role.characterImagePath)
    }
    func testIdentityChangesDoNotResetLearningAndDocumentsStayOwnerScoped() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current)
        let activity = LearningActivity.driving
        try store.save(activity, state: ["note": "original work", "self_completed": true])
        var profile = CrewProfile(name: "星禾", role: story.roles[0], avatar: nil)
        try store.saveDocument(profile, key: CrewProfile.key)
        profile.name = "小航"; profile.role = story.roles[2]
        try store.saveDocument(profile, key: CrewProfile.key)
        XCTAssertEqual(store.load(activity)?["note"] as? String, "original work")
        let reopened = try LearningStore(url: url)
        XCTAssertEqual(try reopened.document(CrewProfile.key, as: CrewProfile.self)?.name, "小航")
        XCTAssertNil(try LearningStore(url: url, owner: "other").document(CrewProfile.key, as: CrewProfile.self))
    }
    func testCompletionNeedsArtifactsAndReplacingEvidenceInvalidatesSelfCheck() throws {
        let chapter = try XCTUnwrap(Expedition.current?.chapters[1])
        var draft = ExpeditionDraft(); draft.checks = [0]; draft.explanations["question"] = "问题"
        XCTAssertEqual(draft.missing(chapter), [chapter.delivery.evidence[0].title])
        try draft.add(ExpeditionArtifact(requirement: "observation", filename: "curve.csv", data: Data("time,flux\n1,1".utf8), origin: "learner-import", createdAt: Date()))
        XCTAssertTrue(draft.checks.isEmpty)
        draft.checks = [0]; XCTAssertTrue(draft.missing(chapter).isEmpty)
        XCTAssertThrowsError(try draft.add(ExpeditionArtifact(requirement: "observation", filename: "large", data: Data(count: 8_000_001), origin: "learner-import", createdAt: Date())))
    }
    func testReceiptIsImmutableAndAdvancesOnlyOneChapter() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current), chapter = story.chapters[0]
        let profile = CrewProfile(name: "星禾", role: story.roles[0], avatar: nil)
        try store.saveDocument(profile, key: CrewProfile.key)
        XCTAssertEqual(story.currentChapter(store: store)?.id, chapter.id)
        let receipt = ExpeditionReceipt(storyId: story.id, chapterId: chapter.id, title: chapter.delivery.title, profile: profile, work: ExpeditionDraft(), sources: [], submittedAt: Date(), reviewStatus: "unit fixture")
        try store.saveDocument(receipt, key: story.receiptKey(chapter), immutable: true)
        XCTAssertThrowsError(try store.saveDocument(receipt, key: story.receiptKey(chapter), immutable: true))
        XCTAssertEqual(story.currentChapter(store: store)?.id, story.chapters[1].id)
        try store.saveDocument(CrewProfile(name: "新名字", role: story.roles[1], avatar: nil), key: CrewProfile.key)
        XCTAssertEqual(try LearningStore(url: url).document(story.receiptKey(chapter), as: ExpeditionReceipt.self)?.profile.name, "星禾")
    }
    func testOnlyCapturedPhotoWithInteractionEvidenceCounts() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current), mission = try XCTUnwrap(TabletMission.current), chapter = story.chapters[0]
        let node = try XCTUnwrap(chapter.nodes(mission).first)
        try store.save(node.activity, state: ["self_completed": true])
        XCTAssertNil(chapter.capturedPhoto(mission: mission, store: store))
        XCTAssertFalse(chapter.isReadyForDelivery(mission: mission, store: store), "Reading alone must not route a learner into an empty first delivery")
        let image = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).jpegData(withCompressionQuality: 0.8) { context in UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 64, height: 64)) }
        let photo: [String: Any] = ["id": "test-photo", "created_at": "2026-11-26T10:00:00Z", "origin": "simulated", "target": "moon", "view": ["yaw": 0.2, "pitch": 0.1, "zoom": 2], "schema_version": "spot-a-world/1", "artifact_id": "sky-observation", "image": "data:image/jpeg;base64," + image.base64EncodedString(), "evidence": ["manual_pan": true, "manual_zoom": true]]
        let text = String(data: try JSONSerialization.data(withJSONObject: [photo]), encoding: .utf8)!
        try store.save(node.activity, state: ["shared_workspace": ["systemedu:spot-a-world:v1": text]])
        XCTAssertNotNil(chapter.capturedPhoto(mission: mission, store: store))
        XCTAssertTrue(chapter.isReadyForDelivery(mission: mission, store: store))
        XCTAssertEqual(try chapter.sources(mission: mission, store: store).first?.activityId, node.activityId)
    }
}
