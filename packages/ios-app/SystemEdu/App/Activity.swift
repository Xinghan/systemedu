import Foundation

// Raw IDs remain compatible with the original three previews and SQLite records.
// Unknown course versions remain readable/exportable even when not installed.
struct LearningActivity: RawRepresentable, Hashable, Identifiable, Codable, CaseIterable {
    let rawValue: String
    init?(rawValue: String) {
        guard rawValue.count <= 220,
              rawValue.range(of: "^[A-Za-z0-9_.:-]+$", options: .regularExpression) != nil else { return nil }
        self.rawValue = rawValue
    }
    static let spaceDossier = Self(rawValue: "course:space-exploration:1.0:JOURNEY")!
    static let driving = Self(rawValue: "driving-intro")!
    static let hand = Self(rawValue: "mechanical-hand")!
    static let landing = Self(rawValue: "mars-landing")!
    static let allCases = [driving, hand, landing]
    var id: String { rawValue }
    var node: ContentNode? { ContentCatalog.nodes[rawValue] }
    var title: String {
        if self == .spaceDossier { return "我的远征档案" }
        if let node { return node.title }
        switch self { case .driving: return "先看路，再决定"; case .hand: return "五指机械手"; case .landing: return "最后一段，怎样着陆？"; default: return "已保存的课程 · \(rawValue.split(separator: ":").last ?? "")" }
    }
    var subtitle: String {
        switch self {
        case .driving: return "从环境输入，到规则与动作。"
        case .hand: return "弯一根手指，沿牵引绳找到驱动端。"
        case .landing: return "跟随下降过程，看清部件为何分离。"
        default: return node.map { "\($0.moduleId) · 阅读与实践" } ?? "原版本暂未安装，记录仍保存在本机。"
        }
    }
    var category: String { self == .hand || self == .landing ? "交互实验 · 3D" : "课程阅读" }
    var symbol: String { self == .hand ? "hand.raised.fingers.spread" : self == .landing ? "sparkles" : "book.closed" }
    var posterURL: URL? {
        guard self == .hand || self == .landing else { return nil }
        return Bundle.main.url(forResource: "WebRuntime", withExtension: nil)?.appendingPathComponent("\(rawValue)/poster.png")
    }
}
