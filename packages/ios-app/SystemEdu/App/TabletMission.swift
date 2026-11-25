import Foundation

struct TabletMissionNode: Decodable, Identifiable {
    let ref: String; let activityId: String; let station: String; let mode: String; let note: String; let title: String
    var id: String { ref }
    var activity: LearningActivity { LearningActivity(rawValue: activityId)! }
    var modeTitle: String {
        switch mode { case "support": return "补充学习"; case "optional": return "选学"; case "replaced": return "旧版参考"; case "experience": return "动手体验"; case "optional-research", "research": return "行星观测研究"; default: return "主线课节" }
    }
}
struct MissionCommander: Decodable {
    let name: String
    let title: String
    let research: String
    let projects: [String: String]
    var signature: String { "\(name) · \(title)" }
}

struct TabletStation: Decodable, Identifiable {
    let id: String; let code: String; let place: String; let message: String; let handoff: String
    let input: String; let gate: String; let film: Int?; let steps: [String]; let projects: [String]
    let briefing: String; let learnerRole: String
    let x: Double; let y: Double; let image: String
}
struct TabletFilm: Decodable, Identifiable {
    let id: String; let title: String; let description: String; let path: String; let captions: String; let poster: String?
}
struct TabletBridge: Decodable, Identifiable { let id: String; let title: String; let status: String; let acceptance: String }
struct MissionChapter: Decodable, Identifiable {
    let station: String
    let title: String
    let body: String
    var id: String { station }
}
struct ProgramTrack: Decodable, Identifiable {
    let id: String
    let title: String
    let question: String
    let detail: String
    let outcome: String
    let entry: String
}
struct ProgramMilestone: Decodable {
    let title: String
    let detail: String
}
struct SpaceSubject: Decodable {
    let title: String
    let body: String
    let entry: String
}
struct MissionHome: Decodable {
    let subjects: [SpaceSubject]
    let furtherStudy: String
    let filmId: String
    let tracks: [ProgramTrack]
    let milestones: [ProgramMilestone]
    let projectName: String
    let accentHex: String
    let brief: String
    let introduction: [String]
    let chapters: [MissionChapter]
    let researchOverview: String
}
struct TabletMission: Decodable {
    let home: MissionHome
    let schemaVersion: Int; let id: String; let version: String; let title: String
    let commander: MissionCommander
    let homeImage: String; let mapImage: String; let stations: [TabletStation]
    let nodes: [TabletMissionNode]; let micro: [TabletMissionNode]; let research: [TabletMissionNode]
    let courseIds: [String]; let films: [TabletFilm]; let bridges: [TabletBridge]
    static let current: TabletMission? = {
        guard let url = bundledURL("/content/missions/space.json"), let data = try? Data(contentsOf: url),
              let mission = try? JSONDecoder().decode(Self.self, from: data), mission.schemaVersion == 1 else { return nil }
        return mission
    }()
    static func bundledURL(_ path: String) -> URL? {
        guard let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil),
              let url = URL(string: "systemedu://bundle" + path) else { return nil }
        return try? AssetSchemeHandler.resolve(url, root: root)
    }
    var allNodes: [TabletMissionNode] { micro + nodes + research }
    var mainSequence: [TabletMissionNode] {
        micro + stations.flatMap { s in s.steps.compactMap { ref in nodes.first { $0.ref == ref } } }
    }
    func lessons(_ station: TabletStation) -> [TabletMissionNode] {
        station.id == "first-contact" ? micro : station.steps.compactMap { ref in nodes.first { $0.ref == ref } }
    }
    func isChoosingDirection(_ records: [LocalRecord]) -> Bool {
        let first = micro[0]
        let ids = Set(allNodes.map(\.activityId))
        return records.first(where: { ids.contains($0.id) })?.id == first.activityId && isRead(first, records: records)
    }
    func entry(for track: ProgramTrack, records: [LocalRecord]) -> TabletMissionNode? {
        let sequence = track.id == "transit" ? research : nodes + micro.filter { $0.id != micro[0].id }
        let ids = Set(sequence.map(\.activityId))
        let relevant = records.filter { ids.contains($0.id) }
        return relevant.isEmpty ? sequence.first { $0.ref == track.entry } : resume(relevant)
    }
    func resume(_ records: [LocalRecord]) -> TabletMissionNode {
        let nodes = allNodes
        guard let current = records.lazy.compactMap({ record in nodes.first { $0.activityId == record.id } }).first else { return micro[0] }
        guard isRead(current, records: records) else { return current }
        // The three introductory experiences are alternatives. Completing one opens the first station task.
        let sequence = current.station == "research" ? research : mainSequence.filter { $0.mode != "experience" }
        let after = sequence.firstIndex(where: { $0.id == current.id }).map { $0 + 1 } ?? 0
        if let next = sequence.dropFirst(after).first(where: { !isRead($0, records: records) })
            ?? sequence.prefix(after).first(where: { !isRead($0, records: records) }) { return next }
        return current
    }
    func isRead(_ node: TabletMissionNode, records: [LocalRecord]) -> Bool {
        guard let r = records.first(where: { $0.id == node.activityId }), r.state["self_completed"] as? Bool == true else { return false }
        let revision = ContentCatalog.current?.courses.first { node.activityId.hasPrefix("course:\($0.id):") }?.contentRevision
        return revision == nil || r.state["content_revision"] as? String == revision
    }
}

struct FilmCaption: Identifiable {
    let start: Double; let end: Double; let text: String
    var id: Double { start }
    static func load(_ path: String) -> [Self] {
        guard let url = TabletMission.bundledURL(path), let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        func seconds(_ s: String) -> Double { s.trimmingCharacters(in: .whitespaces).split(separator: ":").reduce(0) { $0 * 60 + (Double($1) ?? 0) } }
        return text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n\n").compactMap { block in
            let lines = block.components(separatedBy: "\n")
            guard let i = lines.firstIndex(where: { $0.contains(" --> ") }) else { return nil }
            let times = lines[i].components(separatedBy: " --> ")
            guard times.count == 2 else { return nil }
            return Self(start: seconds(times[0]), end: seconds(times[1]), text: lines.dropFirst(i + 1).joined(separator: "\n"))
        }
    }
}
