import Foundation
import Combine
import SQLite3

struct LocalRecord: Identifiable {
    let activity: LearningActivity
    let state: [String: Any]
    let updatedAt: Date
    var id: String { activity.rawValue }
}

enum StoreError: LocalizedError {
    case database(String), invalidState
    var errorDescription: String? {
        switch self { case .database(let message): return "本地记录暂时无法保存：\(message)"; case .invalidState: return "记录格式不正确或内容过大。" }
    }
}

@MainActor
final class LearningStore: ObservableObject {
    @Published private(set) var records: [LocalRecord] = []
    private var database: OpaquePointer?
    // Phase 1 has no account login. A separate owner key prevents future account data mixing.
    private let owner: String
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(url: URL, owner: String = "guest") throws {
        self.owner = owner
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open_v2(url.path, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            if let database { sqlite3_close(database) }; database = nil
            throw StoreError.database("无法打开数据库；原文件已保留")
        }
        do {
            var versionStatement: OpaquePointer?
            guard sqlite3_prepare_v2(database, "PRAGMA user_version", -1, &versionStatement, nil) == SQLITE_OK else { throw StoreError.database("无法读取数据版本") }
            let step = sqlite3_step(versionStatement)
            let version = sqlite3_column_int(versionStatement, 0)
            sqlite3_finalize(versionStatement)
            guard step == SQLITE_ROW, version <= 1 else { throw StoreError.database("记录来自较新版本，请升级 App") }
            try execute("PRAGMA journal_mode=WAL")
            try execute("PRAGMA synchronous=FULL")
            try execute("CREATE TABLE IF NOT EXISTS local_activity (owner TEXT NOT NULL, activity TEXT NOT NULL, state TEXT NOT NULL, updated_at REAL NOT NULL, PRIMARY KEY(owner, activity))")
            try execute("PRAGMA user_version=1")
            try refresh()
        } catch { sqlite3_close(database); database = nil; throw error }
    }

    deinit { sqlite3_close(database) }

    static var defaultURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LearningRecords", isDirectory: true).appendingPathComponent("learning.sqlite")
    }

    private func execute(_ sql: String) throws {
        guard sqlite3_exec(database, sql, nil, nil, nil) == SQLITE_OK else { throw StoreError.database("数据库操作失败") }
    }

    func load(_ activity: LearningActivity) -> [String: Any]? { records.first { $0.activity == activity }?.state }

    @discardableResult
    func save(_ activity: LearningActivity, state: [String: Any]) throws -> Date {
        guard JSONSerialization.isValidJSONObject(state) else { throw StoreError.invalidState }
        let bytes = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
        guard bytes.count <= 128_000, let text = String(data: bytes, encoding: .utf8) else { throw StoreError.invalidState }
        let date = Date()
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, "INSERT INTO local_activity(owner, activity, state, updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,activity) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at", -1, &statement, nil) == SQLITE_OK else { throw StoreError.database("无法准备保存") }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, owner, -1, transient)
        sqlite3_bind_text(statement, 2, activity.rawValue, -1, transient)
        sqlite3_bind_text(statement, 3, text, -1, transient)
        sqlite3_bind_double(statement, 4, date.timeIntervalSince1970)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw StoreError.database("写入未完成，请保留当前页面") }
        try refresh()
        return date
    }

    private func refresh() throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, "SELECT activity,state,updated_at FROM local_activity WHERE owner=? ORDER BY updated_at DESC", -1, &statement, nil) == SQLITE_OK else { throw StoreError.database("无法读取记录") }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, owner, -1, transient)
        var result: [LocalRecord] = []
        var step = sqlite3_step(statement)
        while step == SQLITE_ROW {
            guard let id = sqlite3_column_text(statement, 0), let text = sqlite3_column_text(statement, 1),
                  let activity = LearningActivity(rawValue: String(cString: id)),
                  let state = try JSONSerialization.jsonObject(with: Data(String(cString: text).utf8)) as? [String: Any] else { throw StoreError.invalidState }
            result.append(LocalRecord(activity: activity, state: state, updatedAt: Date(timeIntervalSince1970: sqlite3_column_double(statement, 2))))
            step = sqlite3_step(statement)
        }
        guard step == SQLITE_DONE else { throw StoreError.database("读取未完成") }
        records = result
    }

    func export(_ activity: LearningActivity) throws -> URL {
        let record = records.first { $0.activity == activity }
        let data = try JSONSerialization.data(withJSONObject: ["schema_version": 1, "activity": activity.rawValue, "storage": "local-preview", "state": record?.state ?? [:]], options: [.prettyPrinted, .sortedKeys])
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("systemedu-\(activity.rawValue).json")
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return url
    }
}
