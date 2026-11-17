import SwiftUI

extension Color {
    static let paper = Color(red: 0.966, green: 0.961, blue: 0.933)
    static let forest = Color(red: 0.14, green: 0.29, blue: 0.23)
    static let rust = Color(red: 0.70, green: 0.34, blue: 0.19)
    static let quiet = Color(red: 0.43, green: 0.48, blue: 0.42)
}

struct RootView: View {
    @ObservedObject var store: LearningStore
    var body: some View {
        TabView {
            NavigationStack { LearningHome(store: store) }.tabItem { Label("学习", systemImage: "book.closed") }
            NavigationStack { ExploreView(store: store) }.tabItem { Label("探索", systemImage: "safari") }
            NavigationStack { RecordsView(store: store) }.tabItem { Label("我的", systemImage: "person.crop.circle") }
        }.tint(.forest)
    }
}

private struct LearningHome: View {
    @ObservedObject var store: LearningStore
    var body: some View {
        ViewThatFits(in: .vertical) {
            dashboard
            ScrollView { dashboard }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.paper.ignoresSafeArea()).foregroundStyle(Color.forest)
            .navigationDestination(for: LearningActivity.self) { ClassroomView(activity: $0, store: store) }
            .toolbar(.hidden, for: .navigationBar)
    }
    private var dashboard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text("今天，从哪里开始？").font(.system(size: 26, weight: .medium, design: .serif))
                Spacer()
                Image(systemName: "internaldrive").foregroundStyle(Color.quiet).accessibilityLabel("离线内容")
            }
            NavigationLink(value: store.records.first?.activity ?? LearningActivity.driving) {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(store.records.isEmpty ? "从这里开始" : "继续上次学习").font(.caption)
                        Text((store.records.first?.activity ?? .driving).title).font(.title3.weight(.medium))
                    }
                    Spacer()
                    Image(systemName: "arrow.right.circle.fill").font(.title)
                }.padding(20).foregroundStyle(Color.paper).background(Color.forest, in: RoundedRectangle(cornerRadius: 20))
            }.buttonStyle(.plain).accessibilityIdentifier("continue-learning")
            HStack {
                Text("我的学习内容").font(.subheadline.weight(.semibold))
                Spacer(); Text("3 项 · 已下载").font(.caption).foregroundStyle(Color.quiet)
            }
            VStack(spacing: 10) {
                ForEach(LearningActivity.allCases) { activity in
                    NavigationLink(value: activity) { ActivityCard(activity: activity, compact: true) }
                        .buttonStyle(.plain).accessibilityIdentifier("open-\(activity.rawValue)")
                }
            }
            Text("阅读位置、笔记与实验参数自动保存在本机。").font(.caption).foregroundStyle(Color.quiet)
        }.padding(20).frame(maxWidth: 760, alignment: .leading).frame(maxWidth: .infinity)
    }
}

private struct ActivityCard: View {
    let activity: LearningActivity
    var compact = false
    var body: some View {
        HStack(spacing: compact ? 12 : 18) {
            Group {
                if let url = activity.posterURL, let image = UIImage(contentsOfFile: url.path) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else { Image(systemName: activity.symbol).font(.system(size: 34, weight: .light)).foregroundStyle(Color.rust).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.forest.opacity(0.06)) }
            }.frame(width: compact ? 62 : 100, height: compact ? 70 : 112).clipped().clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: compact ? 5 : 9) {
                if !compact { Text(activity.category).font(.system(size: 10, weight: .medium)).foregroundStyle(Color.rust) }
                Text(activity.title).font(.headline).fixedSize(horizontal: false, vertical: true)
                Text(activity.subtitle).font(.caption).foregroundStyle(Color.quiet).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Color.quiet)
        }.padding(12).background(.white.opacity(0.65), in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct ExploreView: View {
    @ObservedObject var store: LearningStore
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("选择一个问题，动手试一试。").font(.title3).foregroundStyle(Color.quiet)
                ForEach(LearningActivity.allCases) { activity in NavigationLink(value: activity) { ActivityCard(activity: activity, compact: true) }.buttonStyle(.plain) }
                Label("全部已保存在本机", systemImage: "arrow.down.circle.fill").font(.caption).foregroundStyle(Color.quiet)
            }.padding(24).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.background(Color.paper).foregroundStyle(Color.forest).navigationTitle("探索").navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: LearningActivity.self) { ClassroomView(activity: $0, store: store) }
    }
}

private struct RecordsView: View {
    @ObservedObject var store: LearningStore
    @State private var export: SharedFile?
    @State private var error: String?
    var body: some View {
        List {
            Section {
                Label { VStack(alignment: .leading, spacing: 6) { Text("本机学习模式").font(.headline); Text("账号登录与跨设备同步将在后续版本接入。").font(.caption).foregroundStyle(Color.quiet) } } icon: { Image(systemName: "person.crop.circle").font(.largeTitle).foregroundStyle(Color.forest) }.padding(.vertical, 10)
            }
            Section("本机学习记录") {
                if store.records.isEmpty { Text("阅读或操作模型后，记录会出现在这里。").font(.subheadline).foregroundStyle(Color.quiet) }
                ForEach(store.records) { record in
                    HStack {
                        NavigationLink(value: record.activity) { VStack(alignment: .leading, spacing: 5) { Text(record.activity.title); Text(record.updatedAt, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(Color.quiet) } }
                        Button { do { export = SharedFile(url: try store.export(record.activity)) } catch { self.error = error.localizedDescription } } label: { Image(systemName: "square.and.arrow.up") }.buttonStyle(.borderless).accessibilityLabel("导出\(record.activity.title)记录")
                    }
                }
            }
            Section("离线内容") {
                LabeledContent("已内置", value: "1 节课文 · 2 个实验")
                Text("删除 App 会移除未导出的本机记录。当前没有上传到服务器的记录。").font(.caption).foregroundStyle(Color.quiet)
            }
            Section { NavigationLink("组件许可") { NoticesView() }; Text("SystemEdu · 开发预览 0.1").font(.caption).foregroundStyle(Color.quiet) }
        }.scrollContentBackground(.hidden).background(Color.paper).navigationTitle("我的").navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: LearningActivity.self) { ClassroomView(activity: $0, store: store) }
            .sheet(item: $export) { ShareSheet(url: $0.url) }
            .alert("导出失败", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
}
private struct NoticesView: View {
    var body: some View {
        ScrollView { Text(notices).font(.caption.monospaced()).textSelection(.enabled).padding() }.navigationTitle("组件许可")
    }
    private var notices: String {
        guard let url = Bundle.main.url(forResource: "WebRuntime", withExtension: nil)?.appendingPathComponent("THIRD_PARTY_NOTICES.txt"), let text = try? String(contentsOf: url, encoding: .utf8) else { return "许可文件未找到，请重新构建资源。" }
        return text
    }
}
