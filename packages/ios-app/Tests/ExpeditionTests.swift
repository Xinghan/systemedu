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
        XCTAssertLessThanOrEqual(max(image.size.width, image.size.height), 1024)
        XCTAssertGreaterThan(image.size.height, image.size.width)
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
    func testCompletionSampleHasBundledMediaAndLegacyStoryStillDecodes() throws {
        let story = try XCTUnwrap(Expedition.current)
        XCTAssertEqual(Set(story.completionFilms?.keys.map { $0 } ?? []), ["research-P1"])
        let film = try XCTUnwrap(story.completionFilms?["research-P1"])
        let credit = try XCTUnwrap(film.musicCredit)
        XCTAssertEqual(credit.artist, "PeriTune")
        XCTAssertEqual(credit.licenseURL.absoluteString, "https://creativecommons.org/licenses/by/4.0/")
        XCTAssertTrue(story.films.allSatisfy { $0.musicCredit == nil }, "Existing introductory films still decode without music credits")
        XCTAssertFalse(story.films.contains { $0.id == film.id }, "Completion films must not replace stage introductions")
        for path in [film.path, film.captions, try XCTUnwrap(film.poster)] {
            let url = try XCTUnwrap(TabletMission.bundledURL(path))
            XCTAssertGreaterThan(try Data(contentsOf: url).count, 0)
        }
        let captions = FilmCaption.load(film.captions)
        XCTAssertGreaterThan(captions.count, 2)
        XCTAssertTrue(captions.contains { $0.text.contains("星光调查卡") })
        XCTAssertTrue(captions.contains { $0.text.contains("检查观测数据") })
        let source = try XCTUnwrap(TabletMission.bundledURL("/content/missions/space-expedition.json"))
        var legacy = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: source)) as? [String: Any])
        legacy.removeValue(forKey: "completionFilms")
        let decoded = try JSONDecoder().decode(Expedition.self, from: JSONSerialization.data(withJSONObject: legacy))
        XCTAssertNil(decoded.completionFilms)
        XCTAssertEqual(decoded.chapters.flatMap(\.refs), story.chapters.flatMap(\.refs))
        XCTAssertEqual(decoded.films.count, 15)
    }
    func testIdentityChangesDoNotResetLearningAndDocumentsStayOwnerScoped() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current)
        let activity = LearningActivity.driving
        try store.save(activity, state: ["note": "original work", "self_completed": true])
        var profile = CrewProfile(name: "星禾", role: story.roles[0], avatar: nil)
        try store.saveDocument(profile, key: CrewProfile.key)
        profile.name = "小航"; profile.role = story.roles[2]
        profile.avatar = Data("full portrait".utf8); profile.avatarThumbnail = Data("face thumbnail".utf8); profile.avatarFraming = "full-body-v1"
        try store.saveDocument(profile, key: CrewProfile.key)
        XCTAssertEqual(store.load(activity)?["note"] as? String, "original work")
        let reopened = try LearningStore(url: url)
        XCTAssertEqual(try reopened.document(CrewProfile.key, as: CrewProfile.self), profile)
        XCTAssertNil(try LearningStore(url: url, owner: "other").document(CrewProfile.key, as: CrewProfile.self))
    }
    func testReviewAccessPreservesProgressAndLocksFutureNodes() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current), mission = try XCTUnwrap(TabletMission.current)
        let first = story.chapters[0], research = story.chapters[1]
        XCTAssertTrue(story.canVisit(first.nodes(mission)[0], in: first, mission: mission, store: store))
        XCTAssertFalse(story.canVisit(research.nodes(mission)[0], in: research, mission: mission, store: store))
        let receipt = ExpeditionReceipt(storyId: story.id, chapterId: first.id, title: first.delivery.title, profile: CrewProfile(name: "回看测试", role: story.roles[0], avatar: nil), work: ExpeditionDraft(), sources: [], submittedAt: Date(), reviewStatus: "test")
        try store.saveDocument(receipt, key: story.receiptKey(first), immutable: true)
        let nodes = research.nodes(mission)
        var state: [String: Any] = ["self_completed": true, "note": "keep this"]
        if let revision = ContentCatalog.current?.courses.first(where: { nodes[0].activityId.hasPrefix("course:\($0.id):") })?.contentRevision { state["content_revision"] = revision }
        try store.save(nodes[0].activity, state: state)
        let before = try JSONSerialization.data(withJSONObject: store.load(nodes[0].activity)!, options: [.sortedKeys])
        XCTAssertTrue(story.canVisit(nodes[0], in: research, mission: mission, store: store))
        XCTAssertTrue(story.canVisit(nodes[1], in: research, mission: mission, store: store))
        XCTAssertFalse(story.canVisit(nodes[2], in: research, mission: mission, store: store))
        XCTAssertTrue(story.canVisit(first.nodes(mission)[0], in: first, mission: mission, store: store))
        XCTAssertEqual(research.resumeLessonIndex(mission: mission, store: store), 1)
        XCTAssertEqual(try JSONSerialization.data(withJSONObject: store.load(nodes[0].activity)!, options: [.sortedKeys]), before)
        XCTAssertEqual(try store.document(story.receiptKey(first), as: ExpeditionReceipt.self)?.id, receipt.id)
    }
    func testLegacyCrewProfileStillDecodesWithoutFullBodyFields() throws {
        let profile = CrewProfile(name: "原队员", role: try XCTUnwrap(Expedition.current?.roles.first), avatar: Data("old portrait".utf8))
        var legacy = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(profile)) as? [String: Any])
        legacy.removeValue(forKey: "avatarThumbnail"); legacy.removeValue(forKey: "avatarFraming")
        let decoded = try JSONDecoder().decode(CrewProfile.self, from: JSONSerialization.data(withJSONObject: legacy))
        XCTAssertEqual(decoded, profile); XCTAssertNil(decoded.avatarThumbnail); XCTAssertNil(decoded.avatarFraming)
    }
    func testFullBodyThumbnailUsesUpperPortraitAndClassroomReceivesOnlyFace() throws {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let original = UIGraphicsImageRenderer(size: CGSize(width: 600, height: 900), format: format).jpegData(withCompressionQuality: 1) { context in
            UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 600, height: 900))
            UIColor.red.setFill(); context.fill(CGRect(x: 0, y: 0, width: 600, height: 400))
        }
        let thumbnail = try XCTUnwrap(CrewImage.faceThumbnail(original))
        let image = try XCTUnwrap(UIImage(data: thumbnail)); XCTAssertEqual(image.size, CGSize(width: 160, height: 160))
        let profile = CrewProfile(name: "全身队员", role: try XCTUnwrap(Expedition.current?.roles.first), avatar: original, avatarThumbnail: thumbnail, avatarFraming: "full-body-v1")
        let encoded = try XCTUnwrap(CrewClassroomIdentity.payload(profile)["avatar"]?.split(separator: ",").last)
        let face = try XCTUnwrap(Data(base64Encoded: String(encoded)).flatMap(UIImage.init(data:))?.cgImage)
        var pixel = [UInt8](repeating: 0, count: 4)
        let context = try XCTUnwrap(CGContext(data: &pixel, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.draw(face, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        XCTAssertGreaterThan(pixel[0], 220); XCTAssertLessThan(pixel[2], 30, "The small avatar should show the upper face region, not the whole blue body")
        XCTAssertEqual(profile.avatar, original)
        XCTAssertNil(CrewImage.faceThumbnail(Data("invalid".utf8)))
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
    func testCompletedLessonWinsOverStaleCursorWithoutSkippingUnreadWork() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current), mission = try XCTUnwrap(TabletMission.current), chapter = story.chapters[1]
        let nodes = chapter.nodes(mission)
        let revision = try XCTUnwrap(ContentCatalog.current?.courses.first { $0.id == "lightkurve-transit-detective" }?.contentRevision)
        try store.save(nodes[0].activity, state: ["self_completed": true, "content_revision": revision, "note": "keep this observation"])
        try store.saveDocument(ExpeditionDraft(), key: story.draftKey(chapter))
        XCTAssertEqual(chapter.resumeLessonIndex(mission: mission, store: store), 1, "A completed lesson with cursor zero must resume at lesson two")
        var ahead = ExpeditionDraft(); ahead.lessonIndex = nodes.count - 1
        try store.saveDocument(ahead, key: story.draftKey(chapter))
        XCTAssertEqual(chapter.resumeLessonIndex(mission: mission, store: store), 1, "A cursor cannot bypass unfinished lessons")
        let reopened = try LearningStore(url: url)
        XCTAssertEqual(chapter.resumeLessonIndex(mission: mission, store: reopened), 1)
        XCTAssertEqual(reopened.load(nodes[0].activity)?["note"] as? String, "keep this observation")
        try store.save(nodes[0].activity, state: ["self_completed": true, "content_revision": "old-version"])
        XCTAssertEqual(chapter.resumeLessonIndex(mission: mission, store: store), 0, "Existing revision requirements still apply")
    }
    func testEveryChapterHandsOffToItsSuccessorAndSurvivesReopen() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let story = try XCTUnwrap(Expedition.current), mission = try XCTUnwrap(TabletMission.current)
        let profile = CrewProfile(name: "Navigation fixture", role: story.roles[0], avatar: nil)
        for (index, chapter) in story.chapters.enumerated() {
            XCTAssertEqual(story.currentChapter(store: store)?.id, chapter.id)
            XCTAssertEqual(chapter.resumeLessonIndex(mission: mission, store: store), 0)
            let receipt = ExpeditionReceipt(storyId: story.id, chapterId: chapter.id, title: chapter.delivery.title, profile: profile, work: ExpeditionDraft(), sources: [], submittedAt: Date(), reviewStatus: "unit navigation fixture")
            try store.saveDocument(receipt, key: story.receiptKey(chapter), immutable: true)
            let next = index + 1 < story.chapters.count ? story.chapters[index + 1].id : nil
            XCTAssertEqual(story.currentChapter(store: store)?.id, next)
            XCTAssertEqual(story.currentChapter(store: try LearningStore(url: url))?.id, next)
        }
    }
    func testBridgeContinuationRequiresSavedCompletionAndRunsOnlyOnce() throws {
        let (store, url) = try database(); defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let mission = try XCTUnwrap(TabletMission.current), node = mission.research[0]
        let revision = try XCTUnwrap(ContentCatalog.current?.courses.first { $0.id == "lightkurve-transit-detective" }?.contentRevision)
        var advances = 0
        let bridge = LearningWebView.Coordinator(activity: node.activity, store: store, onExport: { _ in }, onExternal: { _ in }, onError: { _ in }, onAdvance: { activity in
            guard activity == node.activity, mission.isRead(node, records: store.records) else { throw StoreError.invalidState }
            advances += 1
        }, onImmersiveChange: { _ in })
        XCTAssertThrowsError(try bridge.advanceOnce()); XCTAssertEqual(advances, 0)
        try store.save(node.activity, state: ["self_completed": true, "content_revision": revision])
        try bridge.advanceOnce(); XCTAssertEqual(advances, 1)
        XCTAssertThrowsError(try bridge.advanceOnce()); XCTAssertEqual(advances, 1)
        bridge.active = false
        XCTAssertThrowsError(try bridge.advanceOnce())
        let request: [String: Any] = ["version": 1, "session": "test", "activity": node.activityId, "request_id": "next", "method": "advance"]
        XCTAssertEqual(try BridgeRequest(body: request, activity: node.activity, session: "test").method, .advance)
        var forged = request; forged["state"] = ["self_completed": true]
        XCTAssertThrowsError(try BridgeRequest(body: forged, activity: node.activity, session: "test"))
    }
}
