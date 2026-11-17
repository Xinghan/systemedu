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
