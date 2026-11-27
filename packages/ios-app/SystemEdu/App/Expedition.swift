import Foundation
import UIKit
import CryptoKit

struct Expedition: Decodable {
    let schemaVersion: Int
    let id: String
    let title: String
    let subtitle: String
    let goal: String
    let commanderImage: String
    let openingFilmId: String
    let roles: [ExpeditionRole]
    let chapters: [ExpeditionChapter]
    let films: [TabletFilm]
    let completionFilms: [String: TabletFilm]?
    let overview: ExpeditionOverview?
    static let current: Self? = {
        guard let url = TabletMission.bundledURL("/content/missions/space-expedition.json"),
              let data = try? Data(contentsOf: url), let story = try? JSONDecoder().decode(Self.self, from: data), story.schemaVersion == 1 else { return nil }
        return story
    }()
    @MainActor func currentChapter(store: LearningStore) -> ExpeditionChapter? {
        chapters.first { (try? store.document(receiptKey($0), as: ExpeditionReceipt.self)) == nil }
    }
    func receiptKey(_ chapter: ExpeditionChapter) -> String { "\(id):receipt:\(chapter.id)" }
    func draftKey(_ chapter: ExpeditionChapter) -> String { "\(id):draft:\(chapter.id)" }
}
struct ExpeditionOverview: Decodable {
    let question: String; let summary: String; let boundary: String
    let acts: [ExpeditionAct]
}
struct ExpeditionAct: Decodable, Identifiable {
    let id: String; let title: String; let symbol: String; let summary: String; let outcome: String; let chapters: [String]
}
struct ExpeditionRole: Codable, Identifiable {
    let id: String; let title: String; let symbol: String; let duty: String
    var artwork: String? = nil
    // Older saved profiles and signed receipts have no artwork field.
    var characterImagePath: String { artwork ?? "/mission/space/expedition-v2/crew/\(["observer", "engineer", "navigator"].contains(id) ? id : "observer").png" }
}
struct ExpeditionChapter: Decodable, Identifiable {
    let id: String; let act: String; let title: String; let arrival: String; let handoff: String
    let refs: [String]; let image: String; let filmId: String; let inputTitle: String?
    let delivery: ExpeditionContract
    let actions: [String]?
    func nodes(_ mission: TabletMission) -> [TabletMissionNode] { refs.compactMap { ref in mission.allNodes.first { $0.ref == ref } } }
}
struct ExpeditionContract: Decodable {
    let title: String; let evidence: [ExpeditionRequirement]; let fields: [ExpeditionField]; let checks: [String]; let boundary: String
}
struct ExpeditionRequirement: Decodable, Identifiable { let id: String; let title: String; let instruction: String }
struct ExpeditionField: Decodable, Identifiable { let id: String; let title: String; let prompt: String }
struct CrewProfile: Codable, Equatable {
    static let key = "crew-profile-v1"
    var name: String
    var role: ExpeditionRole
    var avatar: Data?
    var avatarThumbnail: Data? = nil
    var avatarFraming: String? = nil
    var updatedAt = Date()
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.name == rhs.name && lhs.role.id == rhs.role.id && lhs.avatar == rhs.avatar && lhs.avatarThumbnail == rhs.avatarThumbnail && lhs.avatarFraming == rhs.avatarFraming }
}
struct ExpeditionArtifact: Codable, Identifiable {
    var id = UUID().uuidString
    let requirement: String
    let filename: String
    let data: Data
    let origin: String
    let createdAt: Date
    var digest: String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
}
struct ExpeditionDraft: Codable {
    var artifacts: [ExpeditionArtifact] = []
    var explanations: [String: String] = [:]
    var checks: Set<Int> = []
    var lessonIndex = 0
    var briefingSeen = false
    func missing(_ chapter: ExpeditionChapter) -> [String] {
        var result = chapter.delivery.evidence.filter { req in !artifacts.contains { $0.requirement == req.id && !$0.data.isEmpty } }.map(\.title)
        result += chapter.delivery.fields.filter { (explanations[$0.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.map(\.title)
        if !chapter.delivery.checks.indices.allSatisfy({ checks.contains($0) }) { result.append("对照材料完成自检") }
        return result
    }
    mutating func add(_ artifact: ExpeditionArtifact) throws {
        guard artifact.data.count <= 8_000_000 else { throw StoreError.invalidState }
        let retained = artifacts.filter { $0.requirement != artifact.requirement }
        guard retained.reduce(artifact.data.count, { $0 + $1.data.count }) <= 32_000_000 else { throw StoreError.invalidState }
        artifacts = retained + [artifact]
        checks = [] // Changing a work product invalidates its self-check.
    }
}
struct ExpeditionSource: Codable { let ref: String; let activityId: String; let revision: String?; let state: Data }
struct ExpeditionReceipt: Codable, Identifiable {
    var id = UUID().uuidString
    let storyId: String
    let chapterId: String
    let title: String
    let profile: CrewProfile
    let work: ExpeditionDraft
    let sources: [ExpeditionSource]
    let submittedAt: Date
    let reviewStatus: String
}

enum ExpeditionNavigationError: LocalizedError {
    case photoRequired
    var errorDescription: String? { "请先在望远镜里调整镜头并拍下一张照片，再整理本章作品。" }
}

extension ExpeditionChapter {
    // A saved cursor is a reading position, not the authority on progression.
    // Completion may have been saved just before leaving the classroom.
    @MainActor func resumeLessonIndex(mission: TabletMission, store: LearningStore) -> Int {
        let lessons = nodes(mission)
        return lessons.firstIndex { !mission.isRead($0, records: store.records) } ?? max(0, lessons.count - 1)
    }
    @MainActor func isReadyForDelivery(mission: TabletMission, store: LearningStore) -> Bool {
        id == "first-contact" ? capturedPhoto(mission: mission, store: store) != nil : nodes(mission).allSatisfy { mission.isRead($0, records: store.records) }
    }
    // Only a real capture with interaction evidence can enter the first chapter's delivery.
    @MainActor func capturedPhoto(mission: TabletMission, store: LearningStore) -> ExpeditionArtifact? {
        guard id == "first-contact", let node = nodes(mission).first, let state = store.load(node.activity) else { return nil }
        var values = state["shared_workspace"] as? [String: String] ?? [:]
        for frame in (state["frames"] as? [String: [String: String]] ?? [:]).values { values.merge(frame) { current, _ in current } }
        guard let text = values["systemedu:spot-a-world:v1"], let bytes = text.data(using: .utf8),
              let album = try? JSONSerialization.jsonObject(with: bytes) as? [[String: Any]],
              let photo = album.first(where: { value in
                  let evidence = value["evidence"] as? [String: Any]
                  let view = value["view"] as? [String: Any]
                  return value["schema_version"] as? String == "spot-a-world/1" && value["artifact_id"] as? String == "sky-observation"
                      && value["origin"] as? String == "simulated" && ["moon", "mars"].contains(value["target"] as? String ?? "")
                      && value["id"] as? String != nil && value["created_at"] as? String != nil
                      && view?["yaw"] != nil && view?["pitch"] != nil && view?["zoom"] != nil
                      && evidence?["manual_pan"] as? Bool == true && evidence?["manual_zoom"] as? Bool == true
              }), let image = photo["image"] as? String, image.hasPrefix("data:image/jpeg;base64,"),
              let data = Data(base64Encoded: String(image.dropFirst("data:image/jpeg;base64,".count))), UIImage(data: data) != nil,
              let metadata = try? JSONSerialization.data(withJSONObject: photo, options: [.sortedKeys]) else { return nil }
        // Keep image and metadata together; result view renders the image directly from this JSON.
        return ExpeditionArtifact(requirement: "photo", filename: "星球观测.json", data: metadata, origin: node.activityId, createdAt: Date())
    }
    @MainActor func sources(mission: TabletMission, store: LearningStore) throws -> [ExpeditionSource] {
        try nodes(mission).map { node in
            let state = store.load(node.activity) ?? [:]
            return ExpeditionSource(ref: node.ref, activityId: node.activityId, revision: state["content_revision"] as? String,
                                    state: try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]))
        }
    }
}
