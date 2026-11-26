import SwiftUI

extension Color {
    static let paper = UIDevice.current.userInterfaceIdiom == .pad ? Color.white : Color(red: 0.966, green: 0.961, blue: 0.933)
    static let forest = UIDevice.current.userInterfaceIdiom == .pad ? Color(red: 0.13, green: 0.14, blue: 0.15) : Color(red: 0.14, green: 0.29, blue: 0.23)
    static let rust = Color(red: 0.70, green: 0.34, blue: 0.19)
    static let quiet = UIDevice.current.userInterfaceIdiom == .pad ? Color(white: 0.39) : Color(red: 0.43, green: 0.48, blue: 0.42)
}

extension Color {
    static func projectAccent(_ hex: String?) -> Color {
        guard let hex, hex.count == 7, hex.first == "#", let rgb = UInt32(hex.dropFirst(), radix: 16) else { return .accentColor }
        return Color(red: Double(rgb >> 16) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255)
    }
}

extension ContentCourse {
    var projectTint: Color { .projectAccent(accentHex) }
}

struct RootView: View {
    @ObservedObject var store: LearningStore
    var body: some View {
        if UIDevice.current.userInterfaceIdiom == .pad, let mission = TabletMission.current {
            TabletHomeView(store: store, mission: mission)
        } else { phoneRoot.preferredColorScheme(.light) }
    }
    private var phoneRoot: some View {
        TabView {
            AppNavigationStack(store: store) { LearningHome(store: store) }.tabItem { Label("学习", systemImage: "book.closed") }
            AppNavigationStack(store: store) { CatalogView(store: store) }.tabItem { Label("探索", systemImage: "safari") }
            AppNavigationStack(store: store) { RecordsView(store: store) }.tabItem { Label("我的", systemImage: "person.crop.circle") }
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
            .toolbar(.hidden, for: .navigationBar)
    }
    private var dashboard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text("今天，从哪里开始？").font(.system(size: 26, weight: .medium, design: .serif))
                Spacer()
                Image(systemName: "internaldrive").foregroundStyle(Color.quiet).accessibilityLabel("离线内容")
            }
            NavigationLink(value: AppRoute.activity(store.records.first?.activity ?? LearningActivity.driving)) {
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
                Text("快速体验").font(.subheadline.weight(.semibold))
                Spacer(); NavigationLink("全部课程 →", value: AppRoute.catalog).accessibilityIdentifier("all-courses").font(.caption).foregroundStyle(Color.quiet)
            }
            VStack(spacing: 10) {
                ForEach(LearningActivity.allCases) { activity in
                    NavigationLink(value: AppRoute.activity(activity)) { ActivityCard(activity: activity, compact: true) }
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

struct RecordsView: View {
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
                        NavigationLink(value: AppRoute.activity(record.activity)) { VStack(alignment: .leading, spacing: 5) { Text(record.activity.title); Text(record.updatedAt, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(Color.quiet) } }
                        Button { do { export = SharedFile(url: try store.export(record.activity)) } catch { self.error = error.localizedDescription } } label: { Image(systemName: "square.and.arrow.up") }.buttonStyle(.borderless).accessibilityLabel("导出\(record.activity.title)记录")
                    }
                }
            }
            Section("离线内容") {
                LabeledContent("已内置课程", value: "\(ContentCatalog.current?.courses.count ?? 0) 门")
                LabeledContent("课节总数", value: "\(ContentCatalog.nodes.count) 节")
                Text("删除 App 会移除未导出的本机记录。当前没有上传到服务器的记录。").font(.caption).foregroundStyle(Color.quiet)
            }
            Section { NavigationLink("组件许可") { NoticesView() }; Text("SystemEdu · 开发预览 0.1").font(.caption).foregroundStyle(Color.quiet) }
        }.scrollContentBackground(.hidden).background(Color.paper).navigationTitle("我的").navigationBarTitleDisplayMode(.inline)
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


private enum TabletHomeArea: String, CaseIterable {
    case projects = "我的项目", library = "项目库", records = "学习记录"
    var symbol: String {
        switch self {
        case .projects: return "square.grid.2x2"
        case .library: return "books.vertical"
        case .records: return "clock"
        }
    }
}

private struct TabletHomeView: View {
    @ObservedObject var store: LearningStore
    let mission: TabletMission
    @State private var area: TabletHomeArea = .projects
    @State private var inProject = false
    private var tint: Color { .projectAccent(mission.home.accentHex) }
    private var progress: Int { mission.allNodes.filter { mission.isRead($0, records: store.records) }.count }

    var body: some View {
        if inProject {
            TabletMissionView(store: store, mission: mission, onExit: { area = .projects; inProject = false })
        } else {
            VStack(spacing: 0) {
                HStack(spacing: 24) {
                    Label("SystemEdu", systemImage: "globe.europe.africa.fill").font(.title3.bold())
                    Spacer()
                    ForEach(TabletHomeArea.allCases, id: \.self) { item in
                        Button { area = item } label: {
                            Label(item.rawValue, systemImage: item.symbol)
                                .font(.subheadline.weight(.semibold)).padding(.horizontal, 16).frame(minHeight: 46)
                                .background(area == item ? tint.opacity(0.1) : .clear, in: Capsule())
                        }.buttonStyle(.plain).foregroundStyle(area == item ? tint : Color.quiet)
                            .accessibilityIdentifier("ipad-home-" + String(describing: item))
                            .accessibilityAddTraits(area == item ? .isSelected : [])
                    }
                }.padding(.horizontal, 28).padding(.vertical, 12).background(.white)
                Divider()
                if area == .records {
                    AppNavigationStack(store: store) { RecordsView(store: store) }
                } else {
                    AppNavigationStack(store: store) {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 26) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(area.rawValue).font(.largeTitle.bold()).accessibilityIdentifier("ipad-home-title")
                                    Text(area == .projects ? "从一个好奇的问题，走向自己的发现。" : "选择一个项目，开始一段探索。")
                                        .font(.title3).foregroundStyle(Color.quiet)
                                }
                                Button { inProject = true } label: {
                                    VStack(alignment: .leading, spacing: 0) {
                                        Color.clear.frame(height: 270)
                                            .overlay { BundledMissionImage(path: Expedition.current?.chapters.first?.image ?? mission.homeImage) }.clipped()
                                            .overlay(alignment: .bottomLeading) {
                                                VStack(alignment: .leading, spacing: 8) {
                                                    Text("太空科技").font(.subheadline.weight(.semibold))
                                                    Text(mission.title).font(.system(size: 38, weight: .bold))
                                                }.foregroundStyle(.white).padding(26).frame(maxWidth: .infinity, alignment: .leading)
                                                    .background(LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
                                            }
                                        VStack(alignment: .leading, spacing: 18) {
                                            Text("拍下第一张星球照片，寻找远方的行星，设计自己的探测任务。")
                                                .font(.title3).foregroundStyle(Color.forest)
                                            HStack {
                                                Label("14 章 · 一次完整远航", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                                                Spacer()
                                                Label("进入项目", systemImage: "arrow.right").fontWeight(.semibold).foregroundStyle(tint)
                                            }.font(.subheadline).foregroundStyle(Color.quiet)
                                            if progress > 0 {
                                                Text("课堂阅读与作品各自保存 · 进入后继续当前任务").font(.caption).foregroundStyle(Color.quiet)
                                            }
                                        }.padding(24)
                                    }.background(.white, in: RoundedRectangle(cornerRadius: 24))
                                        .clipShape(RoundedRectangle(cornerRadius: 24))
                                }.buttonStyle(.plain).accessibilityIdentifier("ipad-project-space")

                            }.padding(32).frame(maxWidth: 1080).frame(maxWidth: .infinity)
                        }.background(Color(white: 0.96)).toolbar(.hidden, for: .navigationBar)
                    }
                }
            }.foregroundStyle(Color.forest).tint(tint).preferredColorScheme(.light)
        }
    }
}
