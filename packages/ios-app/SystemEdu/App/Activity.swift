import Foundation

enum LearningActivity: String, CaseIterable, Identifiable, Codable {
    case driving = "driving-intro"
    case hand = "mechanical-hand"
    case landing = "mars-landing"
    var id: String { rawValue }
    var title: String {
        switch self { case .driving: return "先看路，再决定"; case .hand: return "五指机械手"; case .landing: return "最后一段，怎样着陆？" }
    }
    var subtitle: String {
        switch self {
        case .driving: return "从环境输入，到规则与动作。"
        case .hand: return "弯一根手指，沿牵引绳找到驱动端。"
        case .landing: return "跟随下降过程，看清部件为何分离。"
        }
    }
    var category: String { self == .driving ? "课程阅读 · M01" : "交互实验 · 3D" }
    var symbol: String {
        switch self { case .driving: return "point.topleft.down.to.point.bottomright.curvepath"; case .hand: return "hand.raised.fingers.spread"; case .landing: return "sparkles" }
    }
    var posterURL: URL? {
        guard self != .driving else { return nil }
        return Bundle.main.url(forResource: "WebRuntime", withExtension: nil)?.appendingPathComponent("\(rawValue)/poster.png")
    }
}
