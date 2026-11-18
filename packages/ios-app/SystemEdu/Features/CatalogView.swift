import SwiftUI
import AVKit

struct CatalogView: View {
    @ObservedObject var store: LearningStore
    @State private var query = ""
    @State private var selectedLine: String?
    @State private var selectedKind: String?
    private var catalog: ContentCatalog? { ContentCatalog.current }
    private var courses: [ContentCourse] {
        (catalog?.courses ?? []).filter { course in
            (selectedLine == nil || course.lineId == selectedLine) &&
            (selectedKind == nil || course.kind == selectedKind) &&
            (query.isEmpty || course.title.localizedCaseInsensitiveContains(query) || course.modules.contains { $0.title.localizedCaseInsensitiveContains(query) })
        }
    }
    var body: some View {
        VStack(spacing: 0) {
            if let catalog {
                filters(catalog)
                if courses.isEmpty {
                    ContentUnavailableView {
                        Label("没有找到匹配的课程", systemImage: "magnifyingglass")
                    } description: { Text("换一个关键词，或清除主题和类型筛选。") }
                    actions: { Button("显示全部课程") { query = ""; selectedLine = nil; selectedKind = nil } }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(courses) { course in
                                NavigationLink(value: AppRoute.course(course)) {
                                    CatalogCard(course: course, completed: course.completedCount(in: store.records))
                                }.buttonStyle(CoursePressStyle()).accessibilityIdentifier("course-\(course.id)")
                            }
                        }.padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 24)
                            .frame(maxWidth: 760).frame(maxWidth: .infinity)
                    }.scrollDismissesKeyboard(.interactively)
                }
            } else {
                ContentUnavailableView("课程目录未安装", systemImage: "book.closed", description: Text("请重新构建课程资源。已有学习记录仍保留。"))
            }
        }.background(Color.paper).foregroundStyle(Color.forest)
            .navigationTitle("全部课程").navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "搜索项目或课节")
    }
    private func filters(_ catalog: ContentCatalog) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("从一个问题，做出一件作品").font(.subheadline.weight(.medium))
                Spacer(minLength: 8)
                Text("\(courses.count) 项").font(.caption.monospacedDigit()).foregroundStyle(Color.quiet)
                    .accessibilityIdentifier("catalog-count")
            }
            HStack(spacing: 10) {
                Menu {
                    Button("全部主题") { selectedLine = nil }
                    ForEach(catalog.lines) { line in Button(line.title) { selectedLine = line.id } }
                } label: { filterLabel(catalog.lines.first { $0.id == selectedLine }?.title ?? "全部主题", icon: "line.3.horizontal.decrease") }
                    .accessibilityIdentifier("catalog-theme-filter")
                Menu {
                    Button("全部类型") { selectedKind = nil }
                    Button("完整项目") { selectedKind = "full" }
                    Button("专题课程") { selectedKind = "guided" }
                    Button("动手探索") { selectedKind = "micro" }
                    Button("专业课程") { selectedKind = "standalone" }
                } label: { filterLabel(["full":"完整项目", "guided":"专题课程", "micro":"动手探索", "standalone":"专业课程"][selectedKind ?? ""] ?? "全部类型", icon: "square.grid.2x2") }
                    .accessibilityIdentifier("catalog-kind-filter")
                Spacer(minLength: 0)
            }
        }.padding(.horizontal, 20).padding(.vertical, 14).frame(maxWidth: 760)
    }
    private func filterLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 6) { Image(systemName: icon); Text(title); Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)) }
            .font(.caption.weight(.medium)).padding(.horizontal, 12).frame(minHeight: 44)
            .background(.white.opacity(0.8), in: Capsule())
    }
}

private struct CatalogCard: View {
    let course: ContentCourse
    let completed: Int
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 12) {
                    CourseCover(course: course).frame(height: 150).clipShape(RoundedRectangle(cornerRadius: 14))
                    information
                }
            } else {
                HStack(alignment: .center, spacing: 14) {
                    CourseCover(course: course).frame(width: 104, height: 116).clipShape(RoundedRectangle(cornerRadius: 14))
                    information
                }
            }
        }.padding(12).background(.white, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.forest.opacity(0.06), lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityHint("打开项目详情与课程目录")
    }
    private var information: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(course.lineTitle).font(.caption2.weight(.semibold)).foregroundStyle(Color.rust)
            Text(course.title).font(.system(.subheadline, design: .rounded, weight: .semibold))
                .lineLimit(typeSize.isAccessibilitySize ? nil : 3).multilineTextAlignment(.leading)
            HStack(spacing: 5) {
                Text(course.kindTitle); Text("·"); Text("\(course.modules.count) 节")
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").foregroundStyle(Color.forest)
            }.font(.caption2).foregroundStyle(Color.quiet)
            if completed > 0 {
                ProgressView(value: Double(completed), total: Double(course.modules.count)).tint(.forest)
                    .accessibilityLabel("已读完 \(completed) 节，共 \(course.modules.count) 节")
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct CoursePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.72 : 1)
    }
}

struct CourseOutlineView: View {
    let course: ContentCourse
    @ObservedObject var store: LearningStore
    @State private var stage: String?
    @State private var showFilms = false
    @State private var showIntroduction = false
    @State private var initializedStage = false
    @State private var query = ""
    @Environment(\.verticalSizeClass) private var verticalSize
    @Environment(\.dynamicTypeSize) private var typeSize
    private var nodes: [ContentNode] { course.modules.filter { (stage == nil || $0.stage == stage) && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.moduleId.localizedCaseInsensitiveContains(query)) } }
    private var completed: Int { course.completedCount(in: store.records) }
    private var resumeNode: ContentNode? { course.resumeNode(in: store.records) }
    private var hasRecord: Bool { course.modules.contains { node in store.records.contains { $0.id == node.id } } }
    private var hasFilms: Bool { ContentCatalog.current?.films.contains { $0.lineId == course.lineId } == true }

    var body: some View {
        VStack(spacing: 0) {
            if query.isEmpty { introduction }
            HStack(spacing: 12) {
                Menu {
                    Button("全部阶段") { stage = nil }
                    ForEach(course.stages) { s in Button(s.title) { stage = s.id } }
                } label: {
                    HStack(spacing: 8) {
                        Text(course.stages.first { $0.id == stage }?.title ?? "全部课节").lineLimit(1)
                        Image(systemName: "chevron.down").font(.caption2)
                    }.font(.subheadline.weight(.semibold)).frame(minHeight: 44)
                }.accessibilityIdentifier("course-stage-filter")
                Spacer(minLength: 0)
                Text("\(nodes.count) 节").font(.caption).foregroundStyle(Color.quiet)
            }.padding(.horizontal, 20)
            if nodes.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                List(nodes) { node in
                    NavigationLink(value: AppRoute.activity(node.activity)) {
                        HStack(spacing: 12) {
                            if !typeSize.isAccessibilitySize {
                                Text(node.moduleId).font(.caption.monospaced().weight(.medium))
                                    .foregroundStyle(Color.rust).frame(width: 44, height: 44)
                                    .background(Color.rust.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
                            }
                            VStack(alignment: .leading, spacing: 5) {
                                if typeSize.isAccessibilitySize { Text(node.moduleId).font(.caption.monospaced()).foregroundStyle(Color.rust) }
                                Text(node.title).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                                if let s = course.stages.first(where: { $0.id == node.stage }) {
                                    Text(s.title).font(.caption2).foregroundStyle(Color.quiet).lineLimit(1)
                                }
                            }
                            Spacer(minLength: 0)
                            if store.records.contains(where: { $0.id == node.id && $0.state["self_completed"] as? Bool == true }) {
                                Image(systemName: "checkmark.circle.fill").accessibilityLabel("已标记读完")
                            }
                        }.padding(.vertical, 4)
                    }.accessibilityIdentifier("node-\(node.moduleId)")
                        .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                }.listStyle(.plain).scrollContentBackground(.hidden).scrollDismissesKeyboard(.interactively)
            }
        }.frame(maxWidth: 760).frame(maxWidth: .infinity).background(Color.paper).foregroundStyle(Color.forest)
            .navigationTitle("项目详情").navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar).toolbar(.hidden, for: .tabBar)
            .toolbar {
                if hasFilms {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showFilms = true } label: { Image(systemName: "play.rectangle") }.accessibilityLabel("项目导览")
                    }
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { primaryAction }
            .sheet(isPresented: $showFilms) { MissionFilmsView(lineId: course.lineId) }
            .sheet(isPresented: $showIntroduction) { CourseIntroduction(course: course) }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "查找本课程的课节")
            .onAppear {
                if !initializedStage { stage = resumeNode?.stage ?? course.stages.first?.id; initializedStage = true }
            }
    }
    @ViewBuilder private var introduction: some View {
        if verticalSize == .compact {
            HStack(spacing: 16) {
                Text(course.title).font(.headline).lineLimit(1).accessibilityIdentifier("course-detail-title")
                Spacer(minLength: 0)
                Button { showIntroduction = true } label: { Label("介绍", systemImage: "info.circle") }
                    .font(.caption).fixedSize().frame(minHeight: 44).accessibilityIdentifier("course-introduction")
                Text("\(completed) / \(course.modules.count) 节").font(.caption).foregroundStyle(Color.quiet).fixedSize()
                    .accessibilityLabel("已读完 \(completed) 节，共 \(course.modules.count) 节")
            }.padding(.horizontal, 20)
        } else { portraitIntroduction }
    }
    private var portraitIntroduction: some View {
        VStack(alignment: .leading, spacing: 10) {
            if verticalSize != .compact && !typeSize.isAccessibilitySize {
                CourseCover(course: course).frame(height: 126).clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(alignment: .bottomLeading) {
                        Text("\(course.lineTitle) · \(course.kindTitle)").font(.caption2.weight(.semibold))
                            .padding(.horizontal, 10).padding(.vertical, 6).background(Color.paper, in: Capsule()).padding(10)
                    }
            }
            Text(course.title).font(.system(.title3, design: .rounded, weight: .semibold))
                .lineLimit(typeSize.isAccessibilitySize ? 2 : 3).fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("course-detail-title")
            HStack {
                Button { showIntroduction = true } label: { Label("项目介绍", systemImage: "info.circle").font(.caption) }
                    .frame(minHeight: 44).accessibilityIdentifier("course-introduction")
                Spacer()
                Text(typeSize.isAccessibilitySize ? "\(completed) / \(course.modules.count) 节" : "已读完 \(completed) / \(course.modules.count) 节")
                    .font(.caption).foregroundStyle(Color.quiet)
                    .accessibilityLabel("已读完 \(completed) 节，共 \(course.modules.count) 节")
            }
            ProgressView(value: Double(completed), total: Double(max(1, course.modules.count))).tint(.forest)
        }.padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
    }
    private var primaryAction: some View {
        Group {
            if let node = resumeNode {
                NavigationLink(value: AppRoute.activity(node.activity)) {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(hasRecord ? "继续学习" : "开始学习").font(.headline)
                            Text("\(node.moduleId) · \(node.title)").font(.caption).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.right").font(.title3)
                    }.padding(.horizontal, 18).padding(.vertical, 14).foregroundStyle(.white)
                        .background(Color.forest, in: RoundedRectangle(cornerRadius: 18))
                }.buttonStyle(CoursePressStyle()).accessibilityIdentifier("course-start")
            }
        }.padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8).frame(maxWidth: 760)
            .frame(maxWidth: .infinity).background(.regularMaterial)
    }
}

private struct CourseIntroduction: View {
    let course: ContentCourse
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    CourseCover(course: course).frame(height: 190).clipShape(RoundedRectangle(cornerRadius: 20))
                    Text(course.title).font(.title2.weight(.semibold))
                    Text(course.summary ?? "从课程目录选择一节，开始学习。").font(.body).lineSpacing(6)
                    if let outcome = course.outcome, !outcome.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("你将完成").font(.headline)
                            Text(outcome).lineSpacing(6)
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: RoundedRectangle(cornerRadius: 18))
                    }
                    Label("\(course.stages.count) 个阶段 · \(course.modules.count) 节课", systemImage: "list.bullet.rectangle")
                        .font(.subheadline)
                    Text("阅读位置、笔记和实验记录保存在本机。外部视频与链接需要联网。").font(.caption).foregroundStyle(Color.quiet)
                }.padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
            }.background(Color.paper).foregroundStyle(Color.forest)
                .navigationTitle("项目介绍").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } } }
        }
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
