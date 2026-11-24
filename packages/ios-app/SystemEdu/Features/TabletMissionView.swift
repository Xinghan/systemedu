import SwiftUI
import AVKit

private enum TabletArea: String, CaseIterable {
    case home = "项目首页", map = "任务地图", library = "项目资料", dossier = "远征档案", records = "学习记录"
    var symbol: String { switch self { case .home: return "house"; case .map: return "map"; case .library: return "books.vertical"; case .dossier: return "folder.badge.plus"; case .records: return "square.and.pencil" } }
}

struct TabletMissionView: View {
    @ObservedObject var store: LearningStore
    let mission: TabletMission
    @State private var area: TabletArea = .home
    @State private var stationID = "first-contact"
    @State private var film: TabletFilm?
    @State private var path: [AppRoute] = []
    @AppStorage("systemedu.ipad.space.trial-note.v1") private var trialNote = ""
    @State private var journal = false
    private var station: TabletStation { mission.stations.first { $0.id == stationID } ?? mission.stations[0] }
    private var resume: TabletMissionNode { mission.resume(store.records) }

    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize: CGFloat = 44
    private var marsTint: Color { ContentCatalog.current?.courses.first { $0.id == mission.home.primaryCourse }?.projectTint ?? .rust }
    private var returning: Bool { store.records.contains { record in mission.allNodes.contains { $0.activityId == record.id } } }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                header
                Divider()
                switch area {
                case .home: home
                case .map: mapLayout
                case .library: library
                case .records: RecordsView(store: store)
                case .dossier: ClassroomView(activity: .spaceDossier, store: store, onOpenActivity: { path.append(.activity($0)) }, onMissionMap: { area = .map })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.white).foregroundStyle(Color.forest)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .catalog: CatalogView(store: store)
                case .course(let c): CourseOutlineView(course: c, store: store).tint(c.projectTint)
                case .activity(let activity): TabletLessonView(activity: activity, mission: mission, store: store, onMap: { selected in
                    if let n = mission.allNodes.first(where: { $0.activityId == selected.rawValue }), n.station != "research" {
                        stationID = n.station; area = .map; path = []
                    } else if let course = ContentCatalog.current?.courses.first(where: { $0.modules.contains { $0.id == selected.rawValue } }) {
                        area = .library; path = [.course(course)]
                    } else { area = .library; path = [] }
                })
                }
            }
            .sheet(item: $film) { TabletFilmView(film: $0) }
            .sheet(isPresented: $journal) {
                NavigationStack {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("把学习过程中遇到的问题留下来").font(.title2.weight(.semibold))
                        Text("例如：在哪一节停住了，哪段解释不清楚，操作是否顺手。手记只保存在这台设备上，不会自动提交。")
                            .foregroundStyle(Color.quiet)
                        TextEditor(text: $trialNote).padding(12).background(.white).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("ipad-trial-note")
                        Text("自动保存在本机").font(.caption).foregroundStyle(Color.quiet)
                    }.padding(26).background(Color.paper).navigationTitle("试学手记")
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { journal = false } } }
                }.presentationDetents([.large])
            }
        }.tint(marsTint)
    }

    private var header: some View {
        HStack(spacing: 14) {
            if area == .home {
                Image(systemName: "globe.europe.africa.fill").font(.title2).foregroundStyle(marsTint)
                Text("SystemEdu").font(.title3.weight(.bold))
                Divider().frame(height: 18)
                Text(mission.home.projectName).font(.subheadline.weight(.medium))
            } else {
                Button { area = .home } label: { Label("任务首页", systemImage: "chevron.left") }
                    .accessibilityIdentifier("ipad-area-home")
                Divider().frame(height: 18)
                Text(area.rawValue).font(.headline)
            }
            Spacer()
            Menu {
                ForEach(TabletArea.allCases.filter { $0 != .home }, id: \.self) { item in
                    Button {
                        if item == .map { stationID = resume.station == "research" ? "first-contact" : resume.station }
                        area = item
                    } label: { Label(item.rawValue, systemImage: item.symbol) }
                    .accessibilityIdentifier("ipad-area-\(item)")
                }
                Divider()
                Button { journal = true } label: { Label("试学手记", systemImage: "square.and.pencil") }
                    .accessibilityIdentifier("ipad-journal")
            } label: {
                Label("任务手册", systemImage: "book.closed").font(.subheadline.weight(.medium)).padding(.vertical, 10)
            }.accessibilityIdentifier("ipad-mission-menu")
        }
        .frame(minHeight: 56).padding(.horizontal, 25).frame(maxWidth: .infinity)
        .foregroundStyle(Color.forest).background(.white)
    }

    private var home: some View {
        GeometryReader { size in
            let wide = size.size.width >= 880 && !typeSize.isAccessibilitySize
            let margin: CGFloat = size.size.width < 600 ? 20 : (wide ? 52 : 36)
            ScrollView {
                VStack(alignment: .leading, spacing: wide ? 38 : 26) {
                    if wide {
                        HStack(alignment: .center, spacing: 42) {
                            missionDescription
                            videoPreview.frame(width: min(size.size.width * 0.42, 510))
                        }
                    } else {
                        missionDescription
                        videoPreview.frame(maxWidth: size.size.height < 750 ? 390 : .infinity)
                    }
                    nextTask
                }
                .padding(.top, wide ? min(82, size.size.height * 0.09) : 24)
                .padding(.bottom, 24)
                .frame(maxWidth: 1100, alignment: .leading)
                .padding(.horizontal, margin)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var missionDescription: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(spacing: 9) {
                Capsule().fill(marsTint).frame(width: 27, height: 3)
                Text("你的远征任务").font(.subheadline.weight(.semibold)).foregroundStyle(marsTint)
            }
            Text(mission.title).font(.system(size: titleSize, weight: .bold)).tracking(-0.6)
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            Text(mission.home.brief)
                .font(.title3).lineSpacing(6).foregroundStyle(Color(white: 0.28))
                .fixedSize(horizontal: false, vertical: true)
            Text(mission.commander.signature).font(.callout.weight(.medium))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var videoPreview: some View {
        if let openingFilm = mission.films.first(where: { $0.id == "opening" }) {
            Button { film = openingFilm } label: {
                Color(white: 0.92).aspectRatio(16/9, contentMode: .fit)
                    .overlay { BundledMissionImage(path: openingFilm.poster ?? mission.homeImage) }
                    .overlay(alignment: .bottomLeading) {
                        HStack(spacing: 9) {
                            Image(systemName: "play.fill").font(.footnote)
                            Text("播放任务简报").font(.callout.bold())
                        }.foregroundStyle(.white).padding(.horizontal, 15).padding(.vertical, 10)
                            .background(.black.opacity(0.74), in: Capsule()).padding(16)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }
            .buttonStyle(.plain).accessibilityLabel("播放林岚的任务简报").accessibilityIdentifier("ipad-opening-film")
        }
    }

    private var nextTask: some View {
        let node = resume
        let course = ContentCatalog.current?.courses.first { $0.modules.contains { $0.id == node.activityId } }
        let location = (node.station == "research" ? course?.title : mission.stations.first { $0.id == node.station }?.place)
        let label = mission.isRead(node, records: store.records) ? "回顾学习" : (returning ? "继续学习" : "开始学习")
        return VStack(alignment: .leading, spacing: 14) {
            Divider()
            HStack(spacing: 8) {
                Image(systemName: "location.fill")
                Text(returning ? "当前学习任务" : "第一个任务").fontWeight(.semibold)
                if let location { Text("·").accessibilityHidden(true); Text(location) }
            }.font(.subheadline).foregroundStyle(marsTint).padding(.top, 9)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 28) {
                    taskTitle(node).fixedSize(horizontal: true, vertical: true)
                    Spacer(minLength: 10)
                    learnButton(label, node: node)
                }
                VStack(alignment: .leading, spacing: 16) { taskTitle(node); learnButton(label, node: node) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private func taskTitle(_ node: TabletMissionNode) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(node.title).font(.title2.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            if !returning, let firstTask = mission.commander.projects[node.ref.components(separatedBy: ":")[0]] {
                Text(firstTask).font(.body).foregroundStyle(Color.quiet).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
    private func learnButton(_ label: String, node: TabletMissionNode) -> some View {
        Button { open(node) } label: {
            HStack(spacing: 18) { Text(label).font(.headline); Image(systemName: "arrow.right") }
                .padding(.horizontal, 22).frame(minHeight: 52).foregroundStyle(.white)
                .background(marsTint, in: RoundedRectangle(cornerRadius: 12))
        }.buttonStyle(.plain).accessibilityIdentifier("ipad-resume")
    }

    private var mapLayout: some View {
        GeometryReader { size in
            if size.size.width > 880 {
                HStack(spacing: 0) {
                    campus.padding(22).frame(maxWidth: .infinity, maxHeight: .infinity)
                    Divider()
                    stationDetails.frame(width: 330)
                }
            } else {
                VStack(spacing: 0) {
                    campus.padding(16).frame(height: min(355, size.size.height * 0.45))
                    Divider(); stationDetails
                }
            }
        }
    }
    private var campus: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("点击一个任务站，查看要学什么、做什么。").font(.subheadline).foregroundStyle(Color.quiet)
            GeometryReader { box in
                let w = min(box.size.width, box.size.height * 1.5), h = w * 2 / 3
                ZStack {
                    BundledMissionImage(path: mission.mapImage).frame(width: w, height: h)
                    Path { p in
                        for (i,s) in mission.stations.enumerated() {
                            let point = CGPoint(x: s.x / 1536 * w, y: s.y / 1024 * h)
                            if i == 0 { p.move(to: point) } else { p.addLine(to: point) }
                        }
                    }.stroke(.white.opacity(0.8), style: StrokeStyle(lineWidth: 2, dash: [5,5]))
                    ForEach(mission.stations) { s in
                        Button { stationID = s.id } label: {
                            VStack(spacing: 4) {
                                Text(s.code).font(.caption.monospaced().bold()).padding(8).background(s.id == stationID ? Color.rust : Color.forest, in: Capsule())
                                Text(s.place).font(.system(size: w < 600 ? 10 : 12, weight: .semibold)).padding(.horizontal, 5).padding(.vertical, 4).background(Color.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 5))
                            }.foregroundStyle(.white).frame(minWidth: 54, minHeight: 50)
                        }.buttonStyle(.plain).position(x: s.x / 1536 * w, y: s.y / 1024 * h)
                            .accessibilityLabel("\(s.code) \(s.place)").accessibilityIdentifier("ipad-station-\(s.id)")
                    }
                }.frame(width: w, height: h).clipShape(RoundedRectangle(cornerRadius: 17))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
            HStack { Text("8 站 · 从观察到交付"); Spacer(); Text("选中：\(station.code)") }.font(.caption).foregroundStyle(Color.quiet)
        }
    }
    private var stationDetails: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("\(station.code) / 当前任务").font(.caption.monospaced()).foregroundStyle(Color.rust)
                Text(station.place).font(.title2.weight(.semibold))
                Text(mission.commander.signature + "　·　你的职责是" + station.learnerRole).font(.caption).foregroundStyle(Color.rust)
                Text(station.briefing).font(.headline).lineSpacing(4)
                if let number = station.film, let f = mission.films.first(where: { $0.id == "stage-\(number)" }) {
                    Button { film = f } label: { Label("观看任务简报", systemImage: "play.rectangle") }.buttonStyle(.bordered).accessibilityIdentifier("ipad-station-film")
                }
                Text(station.input).font(.subheadline).foregroundStyle(Color.quiet)
                Text(station.id == "first-contact" ? "任选一个体验开始" : "本站学习顺序").font(.headline)
                ForEach(mission.lessons(station)) { node in nodeButton(node) }
                DisclosureGroup("补充与原版课节") {
                    ForEach(mission.nodes.filter { $0.station == station.id && !station.steps.contains($0.ref) }) { node in nodeButton(node) }
                }.font(.subheadline)
                if station.id == "first-contact", let node = mission.research.first {
                    Divider()
                    Text("选学任务 · 抓住行星的影子").font(.headline)
                    Text(mission.commander.research).font(.subheadline).lineSpacing(4)
                    Button("接下凌星调查") { open(node) }.accessibilityIdentifier("ipad-start-transit")
                }
                Divider()
                Text("这一站的成果").font(.headline)
                Text(station.handoff).font(.subheadline).lineSpacing(5)
                Text(station.gate).font(.caption).foregroundStyle(Color.quiet).lineSpacing(5)
                Text("读完标记由你确认，浏览或播放视频不会自动判定任务合格。").font(.caption2).foregroundStyle(Color.quiet)
            }.padding(22).id(station.id)
        }.background(.white.opacity(0.5))
    }
    private func nodeButton(_ node: TabletMissionNode) -> some View {
        Button { open(node) } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: mission.isRead(node, records: store.records) ? "checkmark.circle.fill" : "circle").padding(.top, 3)
                VStack(alignment: .leading, spacing: 6) {
                    Text(node.title).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                    Text(node.modeTitle).font(.caption2).foregroundStyle(Color.quiet)
                    if !node.note.isEmpty { Text(node.note).font(.caption).foregroundStyle(Color.quiet) }
                }
                Spacer(minLength: 0); Image(systemName: "chevron.right").font(.caption)
            }.padding(13).frame(maxWidth: .infinity, minHeight: 54, alignment: .leading).background(.white, in: RoundedRectangle(cornerRadius: 12))
        }.buttonStyle(.plain).accessibilityIdentifier("ipad-node-\(node.ref)")
    }
    private var library: some View {
        List {
            if let node = mission.research.first {
                Section("林岚的选学任务") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("抓住行星的影子").font(.headline)
                        Text(mission.commander.research).font(.subheadline)
                        Button("开始凌星调查") { open(node) }.accessibilityIdentifier("ipad-library-transit")
                    }.padding(.vertical, 6)
                }
            }
            Section("项目影片 · 保留全部原片") {
                ForEach(mission.films) { f in Button { film = f } label: { Label(f.title, systemImage: "play.rectangle").padding(.vertical, 6) } }
            }
            Section("原项目与完整课节") {
                ForEach((ContentCatalog.current?.courses ?? []).filter { mission.courseIds.contains($0.id) }) { c in
                    NavigationLink(value: AppRoute.course(c)) {
                        HStack { CourseCover(course: c).frame(width: 78, height: 62).clipShape(RoundedRectangle(cornerRadius: 8)); VStack(alignment: .leading, spacing: 6) { Text(c.title); Text("\(c.modules.count) 节 · \(c.kindTitle)").font(.caption).foregroundStyle(Color.quiet) } }.padding(.vertical, 4)
                    }
                }
            }
            Section("后续实物阶段仍需验证的内容") {
                ForEach(mission.bridges) { b in VStack(alignment: .leading, spacing: 6) { Text(b.title).font(.subheadline.weight(.medium)); Text(b.acceptance).font(.caption).foregroundStyle(Color.quiet) }.padding(.vertical, 4) }
            }
            Section { NavigationLink("浏览其他已内置课程", value: AppRoute.catalog) }
        }.scrollContentBackground(.hidden)
    }
    private func open(_ node: TabletMissionNode) { path.append(.activity(node.activity)) }
}

struct BundledMissionImage: View {
    let path: String
    var body: some View {
        if let url = TabletMission.bundledURL(path), let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image).resizable().scaledToFill().clipped()
        } else { Rectangle().fill(Color.forest).overlay(Image(systemName: "photo").foregroundStyle(.white)) }
    }
}

private struct TabletLessonView: View {
    @State var activity: LearningActivity
    let mission: TabletMission
    @ObservedObject var store: LearningStore
    let onMap: (LearningActivity) -> Void
    private var course: ContentCourse? { ContentCatalog.current?.courses.first { $0.modules.contains { $0.id == activity.rawValue } } }
    private var onMainRoute: Bool { mission.mainSequence.contains { $0.activityId == activity.rawValue } }
    private var sequence: [LearningActivity] {
        onMainRoute ? mission.mainSequence.map(\.activity) : (course?.modules.map(\.activity) ?? [])
    }
    private var index: Int? { sequence.firstIndex(of: activity) }
    private var briefing: String? { course.flatMap { mission.commander.projects[$0.id] } }
    @Environment(\.dismiss) private var dismiss
    @State private var showBriefing = false
    var body: some View {
        ClassroomView(activity: activity, store: store, onOpenActivity: { activity = $0 }, onMissionMap: { onMap(activity) }).id(activity.rawValue)
            .navigationBarBackButtonHidden()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button { dismiss() } label: { Label("返回", systemImage: "chevron.left") }.accessibilityIdentifier("ipad-lesson-back") }
                ToolbarItem(placement: .topBarTrailing) { Button { onMap(activity) } label: { Label(onMainRoute ? "任务地图" : "课程目录", systemImage: onMainRoute ? "map" : "list.bullet") }.accessibilityIdentifier("ipad-back-map") }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack {
                        if briefing != nil {
                            Button("任务简报") { showBriefing = true }
                                .popover(isPresented: $showBriefing) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        Text(mission.commander.signature).font(.caption).foregroundStyle(Color.rust)
                                        Text(briefing ?? "").lineSpacing(5)
                                    }.padding(22).frame(idealWidth: 350)
                                }
                        }
                        Button("上一节") { move(-1) }.disabled(index == nil || index == 0)
                        Button("下一节") { move(1) }.disabled(index == nil || index == sequence.count - 1)
                    }
                }
            }
            .tint(course?.projectTint ?? .rust)
    }
    private func move(_ delta: Int) { if let i = index, sequence.indices.contains(i + delta) { activity = sequence[i + delta] } }
}

struct TabletFilmView: View {
    let film: TabletFilm
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var player: AVPlayer?
    @State private var observer: Any?
    @State private var seconds = 0.0
    private var captions: [FilmCaption] { FilmCaption.load(film.captions) }
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                VideoPlayer(player: player).aspectRatio(16/9, contentMode: .fit).accessibilityIdentifier("ipad-film-player")
                Text(captions.first { seconds >= $0.start && seconds < $0.end }?.text ?? " ").font(.headline).frame(maxWidth: .infinity, minHeight: 48).multilineTextAlignment(.center).accessibilityIdentifier("ipad-film-caption")
                HStack {
                    Button("播放") { player?.play() }.buttonStyle(.borderedProminent).accessibilityIdentifier("ipad-film-play")
                    Button("暂停") { player?.pause() }.buttonStyle(.bordered)
                    Text("已播放 \(Int(seconds)) 秒").font(.caption.monospaced()).accessibilityIdentifier("ipad-film-time")
                }
                Text(film.description).font(.subheadline).foregroundStyle(Color.quiet)
                ScrollView { VStack(alignment: .leading, spacing: 10) { Text("完整字幕").font(.headline); ForEach(captions) { Text($0.text).font(.subheadline).lineSpacing(5) } }.frame(maxWidth: .infinity, alignment: .leading) }
            }.padding(24).background(Color.paper).navigationTitle(film.title).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
                .onAppear {
                    guard player == nil, let url = TabletMission.bundledURL(film.path) else { return }
                    let p = AVPlayer(url: url); player = p; p.play()
                    observer = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.25, preferredTimescale: 600), queue: .main) { t in seconds = t.seconds.isFinite ? t.seconds : 0 }
                }
                .onChange(of: scenePhase) { _, value in if value != .active { player?.pause() } }
                .onDisappear { player?.pause(); if let observer { player?.removeTimeObserver(observer) }; observer = nil }
        }.presentationDetents([.large])
    }
}
