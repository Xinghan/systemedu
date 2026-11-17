import SwiftUI

@main
struct SystemEduApp: App {
    private let store: Result<LearningStore, Error>
    init() {
        store = Result { try LearningStore(url: LearningStore.defaultURL) }
    }
    var body: some Scene {
        WindowGroup {
            switch store {
            case .success(let store): RootView(store: store).preferredColorScheme(.light)
            case .failure: ContentUnavailableView("本地记录暂时无法打开", systemImage: "externaldrive.badge.exclamationmark", description: Text("原有文件已保留。请关闭 App 后重试，不要卸载 App，以免丢失未导出的记录。"))
            }
        }
    }
}
