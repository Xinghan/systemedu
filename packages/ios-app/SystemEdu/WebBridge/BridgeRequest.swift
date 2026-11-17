import Foundation
import CoreFoundation

struct BridgeRequest {
    enum Method: String { case load, save, export }
    let method: Method
    let state: [String: Any]?

    init(body: Any, activity: LearningActivity, session: String) throws {
        guard let value = body as? [String: Any], JSONSerialization.isValidJSONObject(value),
              try JSONSerialization.data(withJSONObject: value).count <= 514_000,
              Set(value.keys).isSubset(of: ["version", "session", "activity", "request_id", "method", "state"]),
              let version = value["version"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID(), version == 1,
              value["session"] as? String == session, value["activity"] as? String == activity.rawValue,
              let requestID = value["request_id"] as? String, !requestID.isEmpty, requestID.count <= 80,
              let name = value["method"] as? String, let method = Method(rawValue: name),
              method != .save || value["state"] is [String: Any] else { throw StoreError.invalidState }
        self.method = method; state = value["state"] as? [String: Any]
    }
}
