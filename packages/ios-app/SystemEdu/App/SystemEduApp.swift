import SwiftUI

@main
struct SystemEduApp: App {
    private let store: Result<LearningStore, Error>
    init() {
        var url = LearningStore.defaultURL
        #if DEBUG && targetEnvironment(simulator)
        if let value = ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_STORE"], let id = UUID(uuidString: value) {
            url = FileManager.default.temporaryDirectory.appendingPathComponent("uitest-\(id).sqlite")
        }
        #endif
        store = Result {
            let value = try LearningStore(url: url)
            #if DEBUG && targetEnvironment(simulator)
            if url.lastPathComponent.hasPrefix("uitest-"),
               let encoded = ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_CREW_IMAGE"], encoded.count < 250_000,
               let data = Data(base64Encoded: encoded), let clean = CrewImage.jpeg(data),
               try value.document(CrewProfile.key, as: CrewProfile.self) == nil,
               let role = Expedition.current?.roles.first {
                let fullBody = ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_CREW_FRAMING"] == "full-body-v1"
                try value.saveDocument(CrewProfile(name: "Portrait QA", role: role, avatar: clean,
                    avatarThumbnail: fullBody ? CrewImage.faceThumbnail(clean) : nil,
                    avatarFraming: fullBody ? "full-body-v1" : nil), key: CrewProfile.key)
            }
            if url.lastPathComponent.hasPrefix("uitest-"),
               let scenario = ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_EXPEDITION"] {
                try Self.seedNavigationFixture(value, scenario: scenario)
            }
            #endif
            return value
        }
    }
    var body: some Scene {
        WindowGroup {
            switch store {
            case .success(let store): RootView(store: store)
            case .failure: ContentUnavailableView("本地记录暂时无法打开", systemImage: "externaldrive.badge.exclamationmark", description: Text("原有文件已保留。请关闭 App 后重试，不要卸载 App，以免丢失未导出的记录。"))
            }
        }
    }
    #if DEBUG && targetEnvironment(simulator)
    // Only the UUID-isolated UI-test database can receive these synthetic records.
    // Relaunches keep the test's saved progress; the real student database is untouched.
    private static func seedNavigationFixture(_ store: LearningStore, scenario: String) throws {
        guard ["stale-cursor", "chapter-endings", "lesson-summaries"].contains(scenario),
              try store.document(CrewProfile.key, as: CrewProfile.self) == nil,
              let story = Expedition.current, let mission = TabletMission.current else { return }
        let profile = CrewProfile(name: "Navigation QA", role: story.roles[0], avatar: nil)
        try store.saveDocument(profile, key: CrewProfile.key)
        let first = story.chapters[0]
        try store.saveDocument(ExpeditionReceipt(storyId: story.id, chapterId: first.id, title: first.delivery.title, profile: profile,
            work: ExpeditionDraft(), sources: [], submittedAt: Date(), reviewStatus: "Synthetic navigation fixture"), key: story.receiptKey(first), immutable: true)
        for chapter in story.chapters.dropFirst() {
            let nodes = chapter.nodes(mission)
            let completed = scenario == "chapter-endings" ? Array(nodes.dropLast()) : (scenario == "stale-cursor" && chapter.id == story.chapters[1].id ? Array(nodes.prefix(1)) : [])
            for node in completed {
                var state: [String: Any] = ["self_completed": true, "note": "Synthetic navigation fixture"]
                if let revision = ContentCatalog.current?.courses.first(where: { node.activityId.hasPrefix("course:\($0.id):") })?.contentRevision { state["content_revision"] = revision }
                try store.save(node.activity, state: state)
            }
            var draft = ExpeditionDraft(); draft.briefingSeen = true
            // Deliberately stale: resumption must use actual completion, not this cursor.
            draft.lessonIndex = 0
            if scenario == "chapter-endings" || scenario == "lesson-summaries" {
                for requirement in chapter.delivery.evidence {
                    try draft.add(ExpeditionArtifact(requirement: requirement.id, filename: "navigation-fixture.txt",
                        data: Data("Synthetic UI navigation evidence, not student work".utf8), origin: "ui-test-fixture", createdAt: Date()))
                }
                for field in chapter.delivery.fields { draft.explanations[field.id] = "Synthetic navigation fixture; no scientific claim." }
            }
            try store.saveDocument(draft, key: story.draftKey(chapter))
        }
    }
    #endif
}
