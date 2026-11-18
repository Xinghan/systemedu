import Foundation

struct ContentLine: Codable, Identifiable { let id: String; let title: String; let description: String }
struct ContentFilm: Codable, Identifiable { let id: String; let lineId: String; let title: String; let caption: String; let path: String }
struct ContentStage: Codable, Identifiable { let id: String; let title: String }
struct ContentNode: Codable, Identifiable {
    let id: String; let moduleId: String; let title: String; let stage: String; let path: String
    let minutes: Int; let dependsOn: [String]
    var activity: LearningActivity { LearningActivity(rawValue: id)! }
}
struct ContentCourse: Codable, Identifiable, Hashable {
    let id: String; let title: String; let version: String; let lineId: String; let kind: String
    let stages: [ContentStage]; let modules: [ContentNode]; let sourceRoute: String
    let coverPath: String?; let summary: String?; let outcome: String?
    let contentRevision: String?
    var lineTitle: String { ContentCatalog.current?.lines.first { $0.id == lineId }?.title ?? "课程" }
    var kindTitle: String {
        switch kind { case "full": return "完整项目"; case "guided": return "专题课程"; case "micro": return "动手探索"; default: return "专业课程" }
    }
    var coverURL: URL? {
        guard let coverPath, coverPath.hasPrefix("/content/covers/"), !coverPath.contains("..") else { return nil }
        return Bundle.main.url(forResource: "WebRuntime", withExtension: nil)?.appendingPathComponent(String(coverPath.dropFirst()))
    }
    func completedCount(in records: [LocalRecord]) -> Int {
        let ids = Set(modules.map(\.id))
        return records.filter { ids.contains($0.id) && isCompletedInCurrentRevision($0) }.count
    }
    private func isCompletedInCurrentRevision(_ record: LocalRecord) -> Bool {
        record.state["self_completed"] as? Bool == true &&
        (contentRevision == nil || record.state["content_revision"] as? String == contentRevision)
    }
    func resumeNode(in records: [LocalRecord]) -> ContentNode? {
        let byID = Dictionary(uniqueKeysWithValues: modules.map { ($0.id, $0) })
        if let latest = records.first(where: { byID[$0.id] != nil }) {
            if !isCompletedInCurrentRevision(latest) { return byID[latest.id] }
            let completed = Set(records.filter { isCompletedInCurrentRevision($0) }.map(\.id))
            return modules.first { !completed.contains($0.id) } ?? byID[latest.id]
        }
        return modules.first
    }
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id && lhs.version == rhs.version }
    func hash(into hasher: inout Hasher) { hasher.combine(id); hasher.combine(version) }
}
struct ContentCatalog: Codable {
    let schemaVersion: Int; let lines: [ContentLine]; let courses: [ContentCourse]; let films: [ContentFilm]
    static let result: Result<ContentCatalog, Error> = Result {
        guard let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil) else { throw AssetError.missing }
        let data = try Data(contentsOf: root.appendingPathComponent("content/catalog.json"))
        let catalog = try JSONDecoder().decode(ContentCatalog.self, from: data)
        guard catalog.schemaVersion == 1, !catalog.courses.isEmpty else { throw AssetError.missing }
        return catalog
    }
    static var current: ContentCatalog? { try? result.get() }
    static let nodes: [String: ContentNode] = Dictionary(uniqueKeysWithValues: (current?.courses ?? []).flatMap(\.modules).map { ($0.id, $0) })
}
