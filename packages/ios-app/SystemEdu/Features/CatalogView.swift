import SwiftUI
import AVKit

struct CatalogView: View {
    @ObservedObject var store: LearningStore
    @State private var query = ""
    @State private var selectedLine: String?
    private var catalog: ContentCatalog? { ContentCatalog.current }
    private var courses: [ContentCourse] {
        (catalog?.courses ?? []).filter { course in
            (selectedLine == nil || course.lineId == selectedLine) &&
            (query.isEmpty || course.title.localizedCaseInsensitiveContains(query) || course.modules.contains { $0.title.localizedCaseInsensitiveContains(query) })
        }
    }
    var body: some View {
        VStack(spacing: 0) {
            if let catalog {
                HStack {
                    Menu {
                        Button("全部主题") { selectedLine = nil }
                        ForEach(catalog.lines) { line in Button(line.title) { selectedLine = line.id } }
                    } label: { Label(catalog.lines.first { $0.id == selectedLine }?.title ?? "全部主题", systemImage: "line.3.horizontal.decrease") }
                    Spacer()
                    Text("\(courses.count) 个项目").font(.caption).foregroundStyle(Color.quiet)
                }.padding(.horizontal, 20).padding(.vertical, 10)
                List {
                    ForEach(courses) { course in
                        NavigationLink(value: course) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(course.title).font(.headline).lineLimit(3)
                                HStack { Text(catalog.lines.first { $0.id == course.lineId }?.title ?? "课程"); Spacer(); Text("\(course.modules.count) 节") }.font(.caption).foregroundStyle(Color.quiet)
                            }.padding(.vertical, 6)
                        }.accessibilityIdentifier("course-\(course.id)")
                    }
                }.listStyle(.plain).scrollContentBackground(.hidden)
            } else {
                ContentUnavailableView("课程目录未安装", systemImage: "book.closed", description: Text("请重新构建课程资源。已有学习记录仍保留。"))
            }
        }.background(Color.paper).foregroundStyle(Color.forest)
            .navigationTitle("全部课程").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "搜索项目或课节")
            .navigationDestination(for: ContentCourse.self) { CourseOutlineView(course: $0, store: store) }
            .navigationDestination(for: LearningActivity.self) { ClassroomView(activity: $0, store: store) }
    }
}

struct CourseOutlineView: View {
    let course: ContentCourse
    @ObservedObject var store: LearningStore
    @State private var stage: String?
    @State private var showFilms = false
    @State private var query = ""
    private var nodes: [ContentNode] { course.modules.filter { (stage == nil || $0.stage == stage) && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.moduleId.localizedCaseInsensitiveContains(query)) } }
    private var completed: Int { course.modules.filter { store.load($0.activity)?["self_completed"] as? Bool == true }.count }
    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                Text(course.title).font(.title3.weight(.semibold)).lineLimit(3)
                HStack {
                    Menu {
                        Button("全部阶段") { stage = nil }
                        ForEach(course.stages) { s in Button(s.title) { stage = s.id } }
                    } label: { Label(course.stages.first { $0.id == stage }?.title ?? "全部阶段", systemImage: "list.bullet") }.lineLimit(1)
                    Spacer()
                    Text("已读完 \(completed)/\(course.modules.count)").font(.caption).foregroundStyle(Color.quiet)
                }
            }.padding(20)
            List(nodes) { node in
                NavigationLink(value: node.activity) {
                    HStack(spacing: 14) {
                        Text(node.moduleId).font(.caption.monospaced()).foregroundStyle(Color.rust).frame(width: 40)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(node.title).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                            if let s = course.stages.first(where: { $0.id == node.stage }) { Text(s.title).font(.caption).foregroundStyle(Color.quiet) }
                        }
                        Spacer(minLength: 0)
                        if store.load(node.activity)?["self_completed"] as? Bool == true { Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.forest).accessibilityLabel("已标记读完") }
                    }.padding(.vertical, 5)
                }.accessibilityIdentifier("node-\(node.moduleId)")
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }.background(Color.paper).foregroundStyle(Color.forest)
            .navigationTitle("课程目录").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { showFilms = true } label: { Image(systemName: "play.rectangle") }.accessibilityLabel("项目导览") } }
            .sheet(isPresented: $showFilms) { MissionFilmsView(lineId: course.lineId) }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "查找本课程的课节")
    }
}


private struct MissionFilmsView: View {
    let lineId: String
    @Environment(\.dismiss) private var dismiss
    @State private var selected: ContentFilm?
    @State private var player: AVPlayer?
    private var films: [ContentFilm] { (ContentCatalog.current?.films ?? []).filter { $0.lineId == lineId } }
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                if let film = selected {
                    VideoPlayer(player: player).frame(maxWidth: .infinity).aspectRatio(16/9, contentMode: .fit)
                    Text(film.title).font(.title3.weight(.semibold))
                    ScrollView { Text(film.caption).font(.body).lineSpacing(6).frame(maxWidth: .infinity, alignment: .leading) }
                } else { ContentUnavailableView("本主题暂无导览影片", systemImage: "play.rectangle") }
                Menu {
                    ForEach(films) { film in Button(film.title) { select(film) } }
                } label: { Label("选择导览影片", systemImage: "list.bullet").frame(maxWidth: .infinity).padding(14).background(Color.forest.opacity(0.08), in: RoundedRectangle(cornerRadius: 12)) }
            }.padding(20).background(Color.paper).navigationTitle("项目导览").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } } }
                .onAppear { if let first = films.first { select(first) } }
                .onDisappear { player?.pause() }
        }
    }
    private func select(_ film: ContentFilm) {
        player?.pause(); selected = film
        if let root = Bundle.main.url(forResource: "WebRuntime", withExtension: nil) {
            player = AVPlayer(url: root.appendingPathComponent(String(film.path.dropFirst())))
        }
    }
}
