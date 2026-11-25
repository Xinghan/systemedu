import SwiftUI

private enum TabletArea: String, CaseIterable {
    case stage = "阶段任务", home = "项目全景", directions = "探索方向", map = "探测工程地图", library = "项目资料", dossier = "远征档案", records = "学习记录"
    var symbol: String { switch self { case .stage: return "flag"; case .home: return "house"; case .directions: return "signpost.right"; case .map: return "map"; case .library: return "books.vertical"; case .dossier: return "folder.badge.plus"; case .records: return "square.and.pencil" } }
}

struct TabletMissionView: View {
    @ObservedObject var store: LearningStore
    let mission: TabletMission
    var onExit: () -> Void = {}
    @State private var area: TabletArea = .home
    @State private var stationID = "first-contact"
    @State private var researchStage: String?
    @State private var researchOverview = false
    @State private var showOverview = false
    @State private var film: TabletFilm?
    @State private var path: [AppRoute] = []
    @AppStorage("systemedu.ipad.space.trial-note.v1") private var trialNote = ""
    @State private var journal = false
    private var station: TabletStation { mission.stations.first { $0.id == stationID } ?? mission.stations[0] }
    private var resume: TabletMissionNode { mission.resume(store.records) }

    private var programTint: Color { .projectAccent(mission.home.accentHex) }
    private var returning: Bool { store.records.contains { record in mission.allNodes.contains { $0.activityId == record.id } } }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                header
                Divider()
                switch area {
                case .home: home
                case .stage: stagePage
                case .directions: ScrollView { directions.padding(28).frame(maxWidth: .infinity) }
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
                case .activity(let activity): TabletLessonView(activity: activity, mission: mission, store: store, onDirections: { path = []; area = .directions }, onStage: { showStage(for: $0) }, onMap: { selected in
                    if let n = mission.allNodes.first(where: { $0.activityId == selected.rawValue }), n.station != "research" {
                        stationID = n.station; area = .map; path = []
                    } else if let course = ContentCatalog.current?.courses.first(where: { $0.modules.contains { $0.id == selected.rawValue } }) {
                        area = .library; path = [.course(course)]
                    } else { area = .library; path = [] }
                })
                }
            }
            .sheet(isPresented: $showOverview) {
                NavigationStack {
                    ScrollView { missionOverview.padding(28) }
                        .navigationTitle("项目说明").navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { showOverview = false } } }
                }
            }
            .fullScreenCover(item: $film) { TabletFilmView(film: $0) }
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
        }.tint(programTint)
            .onAppear { researchOverview = resume.station == "research" }
    }

    private var header: some View {
        HStack(spacing: 14) {
            if area == .home {
                Button(action: onExit) { Label("我的项目", systemImage: "chevron.left") }
                    .accessibilityIdentifier("ipad-exit-project")
                Divider().frame(height: 18)
                Text(mission.title).font(.headline)
            } else {
                Button { area = .home } label: { Label("项目全景", systemImage: "chevron.left") }
                    .accessibilityIdentifier("ipad-area-home")
                Divider().frame(height: 18)
                Text(area.rawValue).font(.headline)
            }
            Spacer()
            Menu {
                ForEach(TabletArea.allCases.filter { $0 != .home && $0 != .stage }, id: \.self) { item in
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
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(alignment: .center, spacing: 24) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("太空科技").font(.subheadline.bold()).foregroundStyle(programTint)
                            Text(mission.title).font(.system(size: 38, weight: .bold)).accessibilityIdentifier("ipad-program-title")
                            Text("从第一次观测，到独立完成一项研究或探测任务。")
                                .font(.title3).foregroundStyle(Color.quiet)
                            Button("了解项目") { showOverview = true }.font(.subheadline).accessibilityIdentifier("ipad-read-overview")
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        videoPreview.frame(width: size.size.width < 850 ? 260 : 340)
                    }
                    nextTask
                    HStack(alignment: .firstTextBaseline) {
                        Text("探索旅程").font(.title2.bold())
                        Spacer()
                        Button("选择方向") { area = .directions }.accessibilityIdentifier("ipad-browse-tracks")
                    }
                    Picker("探索方向", selection: $researchOverview) {
                        Text("探测工程 · 8 阶段").tag(false)
                        Text("行星研究 · 6 阶段").tag(true)
                    }.pickerStyle(.segmented).accessibilityIdentifier("ipad-journey-track")
                    if researchOverview {
                        if let course = researchCourse {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 18)], spacing: 18) {
                                ForEach(Array(course.stages.enumerated()), id: \.element.id) { index, stage in
                                    stageCard(title: stage.title, number: index + 1, image: course.coverPath ?? mission.homeImage,
                                              nodes: researchNodes(stage.id), identifier: "research-" + stage.id) {
                                        researchStage = stage.id; area = .stage
                                    }
                                }
                            }
                        }
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 18)], spacing: 18) {
                            ForEach(Array(mission.stations.enumerated()), id: \.element.id) { index, stage in
                                stageCard(title: stage.place, number: index + 1, image: stage.image,
                                          nodes: mission.lessons(stage), identifier: stage.id) {
                                    stationID = stage.id; researchStage = nil; area = .stage
                                }
                            }
                        }
                    }
                }.padding(28).frame(maxWidth: 1160).frame(maxWidth: .infinity)
            }.background(Color(white: 0.97))
        }
    }

    private func stageCard(title: String, number: Int, image: String, nodes: [TabletMissionNode], identifier: String, action: @escaping () -> Void) -> some View {
        let completed = nodes.filter { mission.isRead($0, records: store.records) }.count
        let current = nodes.contains { $0.id == resume.id }
        return Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear.frame(height: 135).overlay { BundledMissionImage(path: image) }.clipped()
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("阶段 \(number)").font(.caption.bold()).foregroundStyle(programTint)
                        Spacer()
                        if current { Text("当前").font(.caption.bold()).foregroundStyle(programTint) }
                        else if completed == nodes.count && completed > 0 { Image(systemName: "checkmark.circle.fill").foregroundStyle(programTint) }
                    }
                    Text(title).font(.headline).multilineTextAlignment(.leading).lineLimit(2)
                    HStack {
                        Text(completed > 0 ? "已读 \(completed) / \(nodes.count) 节" : (number == 1 && !researchOverview ? "从第一次观测开始" : "\(nodes.count) 节任务"))
                        Spacer()
                        Image(systemName: "arrow.right")
                    }.font(.caption).foregroundStyle(Color.quiet)
                }.padding(16)
            }.background(.white).clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(current ? programTint : .clear, lineWidth: 2))
        }.buttonStyle(.plain).accessibilityIdentifier("ipad-stage-" + identifier)
    }

    @ViewBuilder private var videoPreview: some View {
        if let openingFilm = mission.films.first(where: { $0.id == mission.home.filmId }) {
            Button { film = openingFilm } label: {
                Color(white: 0.92).aspectRatio(16/9, contentMode: .fit)
                    .overlay { BundledMissionImage(path: openingFilm.poster ?? mission.homeImage) }
                    .overlay(alignment: .bottomLeading) {
                        HStack(spacing: 9) {
                            Image(systemName: "play.fill").font(.footnote)
                            Text("观看项目简报").font(.callout.bold())
                        }.foregroundStyle(.white).padding(.horizontal, 15).padding(.vertical, 10)
                            .background(.black.opacity(0.74), in: Capsule()).padding(16)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }
            .buttonStyle(.plain).accessibilityLabel("播放星际远航方向简报").accessibilityIdentifier("ipad-opening-film")
        }
    }

    private var nextTask: some View {
        let choose = mission.isChoosingDirection(store.records)
        let node = choose ? mission.micro[0] : resume
        let course = ContentCatalog.current?.courses.first { $0.modules.contains { $0.id == node.activityId } }
        let location = (node.station == "research" ? course?.title : mission.stations.first { $0.id == node.station }?.place)
        let label = choose ? "选择探索方向" : mission.isRead(node, records: store.records) ? "回顾学习" : (returning ? "继续学习" : "开始学习")
        return VStack(alignment: .leading, spacing: 14) {
            Divider()
            HStack(spacing: 8) {
                Image(systemName: "location.fill")
                Text(returning ? "当前学习任务" : "第一个任务").fontWeight(.semibold)
                if let location, !choose { Text("·").accessibilityHidden(true); Text(location) }
            }.font(.subheadline).foregroundStyle(programTint).padding(.top, 9)
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
            Text(mission.isChoosingDirection(store.records) ? "你的第一次观测已完成" : node.title).font(.title2.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            if !returning, let firstTask = mission.commander.projects[node.ref.components(separatedBy: ":")[0]] {
                Text(firstTask).font(.body).foregroundStyle(Color.quiet).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
    private func learnButton(_ label: String, node: TabletMissionNode) -> some View {
        Button {
            if mission.isChoosingDirection(store.records) { area = .directions } else { showStage(for: node.activity) }
        } label: {
            HStack(spacing: 18) { Text(label == "开始学习" ? "进入第一阶段" : label).font(.headline); Image(systemName: "arrow.right") }
                .padding(.horizontal, 22).frame(minHeight: 52).foregroundStyle(.white)
                .background(programTint, in: RoundedRectangle(cornerRadius: 12))
        }.buttonStyle(.plain).accessibilityIdentifier("ipad-resume")
    }

    private var directions: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("接下来，向哪里探索？").font(.largeTitle.bold())
            Text("完成第一次观测后，选择想继续追问的问题。你随时可以回来换一个方向。")
                .foregroundStyle(Color.quiet)
            ForEach(mission.home.tracks) { track in
                if let node = mission.entry(for: track, records: store.records),
                   let course = ContentCatalog.current?.courses.first(where: { $0.modules.contains { $0.id == node.activityId } }) {
                    Button { showStage(for: node.activity) } label: {
                        HStack(spacing: 24) {
                            CourseCover(course: course).frame(width: 220, height: 170).clipped().clipShape(RoundedRectangle(cornerRadius: 16))
                            VStack(alignment: .leading, spacing: 12) {
                                Text(track.title).font(.title2.bold())
                                Text(track.question).font(.body).foregroundStyle(Color.quiet)
                                Label("查看下一阶段", systemImage: "arrow.right").font(.subheadline.bold()).foregroundStyle(programTint)
                            }.multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                        }.padding(20).background(.white, in: RoundedRectangle(cornerRadius: 22))
                    }.buttonStyle(.plain).accessibilityIdentifier("ipad-track-" + track.id)
                }
            }
        }.frame(maxWidth: 1000, alignment: .leading)
    }

    private var researchCourse: ContentCourse? {
        ContentCatalog.current?.courses.first { $0.id == mission.research.first?.ref.components(separatedBy: ":").first }
    }
    private func researchNodes(_ stage: String) -> [TabletMissionNode] {
        let ids = Set(researchCourse?.modules.filter { $0.stage == stage }.map(\.id) ?? [])
        return mission.research.filter { ids.contains($0.activityId) }
    }
    private var stageNodes: [TabletMissionNode] {
        researchStage.map { researchNodes($0) } ?? mission.lessons(station)
    }
    private func showStage(for activity: LearningActivity) {
        guard let node = mission.allNodes.first(where: { $0.activityId == activity.rawValue }) else { return }
        researchStage = node.station == "research" ? researchCourse?.modules.first { $0.id == node.activityId }?.stage : nil
        if node.station != "research" { stationID = node.station }
        area = .stage; path = []
    }
    private var stagePage: some View {
        let nodes = stageNodes
        let title = researchStage.flatMap { id in researchCourse?.stages.first { $0.id == id }?.title } ?? station.place
        let number = researchStage.flatMap { id in researchCourse?.stages.firstIndex { $0.id == id } }.map { $0 + 1 }
            ?? ((mission.stations.firstIndex { $0.id == stationID } ?? 0) + 1)
        let courseIDs = nodes.reduce(into: [String]()) { ids, node in
            if let id = node.ref.components(separatedBy: ":").first, !ids.contains(id) { ids.append(id) }
        }
        let courses = courseIDs.compactMap { id in ContentCatalog.current?.courses.first { $0.id == id } }
        return ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .center, spacing: 28) {
                    Color.clear.frame(width: 260, height: 180)
                        .overlay { BundledMissionImage(path: researchStage == nil ? station.image : (researchCourse?.coverPath ?? mission.homeImage)) }
                        .clipped().clipShape(RoundedRectangle(cornerRadius: 18))
                    VStack(alignment: .leading, spacing: 10) {
                        Text("阶段 \(number)").font(.subheadline.bold()).foregroundStyle(programTint)
                        Text(title).font(.largeTitle.bold()).accessibilityIdentifier("ipad-stage-title")
                        Text(researchStage == nil ? station.handoff : "记录你的判断、数据和检验结果，逐步完成凌星调查。")
                            .font(.body).foregroundStyle(Color.quiet)
                        if let next = nodes.first(where: { $0.id == resume.id }) ?? nodes.first(where: { !mission.isRead($0, records: store.records) }) ?? nodes.first {
                            Button { open(next) } label: {
                                Label("\(nodes.contains { mission.isRead($0, records: store.records) } ? "继续本阶段" : "开始本阶段")", systemImage: "play.fill")
                                    .font(.headline).foregroundStyle(.white).padding(.horizontal, 18).frame(minHeight: 48)
                            }.buttonStyle(.borderedProminent).accessibilityIdentifier("ipad-stage-start")
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                if researchStage == nil, let number = station.film,
                   let briefing = mission.films.first(where: { $0.id == "stage-\(number)" }) {
                    Button { film = briefing } label: {
                        Label("听林岚介绍本阶段任务", systemImage: "play.rectangle.fill").font(.headline).frame(minHeight: 48)
                    }.accessibilityIdentifier("ipad-stage-film")
                }
                Text(stationID == "first-contact" && researchStage == nil ? "先完成星球观测，也可以试试着陆和驾驶" : "本阶段任务").font(.title2.bold())
                ForEach(courses) { course in
                    DisclosureGroup {
                        ForEach(nodes.filter { n in course.modules.contains { $0.id == n.activityId } }) { node in nodeButton(node) }
                    } label: {
                        HStack(spacing: 18) {
                            CourseCover(course: course).frame(width: 130, height: 88).clipped().clipShape(RoundedRectangle(cornerRadius: 12))
                            VStack(alignment: .leading, spacing: 8) {
                                Text(course.title).font(.headline)
                                Text("\(nodes.filter { n in course.modules.contains { $0.id == n.activityId } }.count) 节 · 展开学习顺序")
                                    .font(.subheadline).foregroundStyle(Color.quiet)
                            }
                        }.padding(.vertical, 6)
                    }.padding(16).background(.white, in: RoundedRectangle(cornerRadius: 18))
                        .accessibilityIdentifier("ipad-stage-course-" + course.id)
                }
                if researchStage == nil {
                    DisclosureGroup("阶段说明与补充课节") {
                        Text(station.briefing).padding(.vertical, 12)
                        ForEach(mission.nodes.filter { $0.station == stationID && !station.steps.contains($0.ref) }) { node in nodeButton(node) }
                    }
                }
                Divider()
                stageTransition
            }.padding(28).frame(maxWidth: 1040).frame(maxWidth: .infinity)
        }.background(Color(white: 0.97)).id(title)
    }

    @ViewBuilder private var stageTransition: some View {
        if researchStage == nil && stationID == "first-contact" {
            Button { area = .directions } label: { Label("下一阶段 · 选择探索方向", systemImage: "arrow.right.circle.fill") }
                .accessibilityIdentifier("ipad-stage-next").frame(minHeight: 50)
        } else if let id = researchStage, let stages = researchCourse?.stages,
                  let index = stages.firstIndex(where: { $0.id == id }), index + 1 < stages.count {
            Button { researchStage = stages[index + 1].id } label: { Label("下一阶段 · " + stages[index + 1].title, systemImage: "arrow.right.circle.fill") }
                .accessibilityIdentifier("ipad-stage-next").frame(minHeight: 50)
        } else if researchStage == nil, let index = mission.stations.firstIndex(where: { $0.id == stationID }), index + 1 < mission.stations.count {
            Button { stationID = mission.stations[index + 1].id } label: { Label("下一阶段 · " + mission.stations[index + 1].place, systemImage: "arrow.right.circle.fill") }
                .accessibilityIdentifier("ipad-stage-next").frame(minHeight: 50)
        } else {
            Button { area = .home } label: { Label("返回项目全景", systemImage: "square.grid.2x2") }.frame(minHeight: 50)
        }
    }

    private var missionOverview: some View {
        VStack(alignment: .leading, spacing: 22) {
            Divider()
            HStack(alignment: .firstTextBaseline) {
                Text("星际远航项目总览").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Spacer()
            }
            ForEach(mission.home.introduction, id: \.self) { text in overviewParagraph(text) }
            VStack(alignment: .leading, spacing: 14) {
                Text("太空科技知识地图").font(.title2.bold()).accessibilityAddTraits(.isHeader)
                ForEach(mission.home.subjects, id: \.title) { subject in
                    DisclosureGroup(subject.title) {
                        VStack(alignment: .leading, spacing: 8) {
                            overviewParagraph(subject.body)
                            if let node = mission.allNodes.first(where: { $0.ref == subject.entry }) {
                                Button { showOverview = false; open(node) } label: { Label(node.title, systemImage: "book").frame(minHeight: 44) }
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    }.padding(.vertical, 4)
                    Divider()
                }
            }.id("space-subjects")
            Text("你会怎样一步步深入").font(.title2.bold())
            ForEach(mission.home.milestones, id: \.title) { step in
                VStack(alignment: .leading, spacing: 6) {
                    Text(step.title).font(.headline)
                    overviewParagraph(step.detail)
                }
            }
            overviewParagraph(mission.home.furtherStudy)
        }
        .frame(maxWidth: 850, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .id("mission-overview")
    }

    private func overviewParagraph(_ text: String) -> some View {
        Text(text).font(.body).lineSpacing(7).fixedSize(horizontal: false, vertical: true)
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
                    Text("另一专业方向 · 行星观测与研究").font(.headline)
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
                Section("行星观测与研究") {
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
    @State private var image: UIImage?
    var body: some View {
        GeometryReader { geometry in
            Group {
                if let image { Image(uiImage: image).resizable().scaledToFill() }
                else { Rectangle().fill(Color.forest.opacity(0.12)) }
            }.frame(width: geometry.size.width, height: geometry.size.height).clipped()
        }.task(id: path) {
            guard let url = TabletMission.bundledURL(path) else { image = nil; return }
            let loaded = await Task.detached(priority: .utility) { CourseImageCache.load(url) }.value
            if !Task.isCancelled { image = loaded }
        }.accessibilityHidden(true)
    }
}

private struct TabletLessonView: View {
    @State var activity: LearningActivity
    let mission: TabletMission
    @ObservedObject var store: LearningStore
    let onDirections: () -> Void
    let onStage: (LearningActivity) -> Void
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
                        if activity == mission.micro[0].activity {
                            Button("选择探索方向", action: onDirections).accessibilityIdentifier("ipad-lesson-directions")
                        } else {
                            Button(nextIsNewStage ? "下一阶段" : "下一节") { move(1) }.disabled(index == nil || index == sequence.count - 1)
                        }
                    }
                }
            }
            .tint(course?.projectTint ?? .rust)
    }
    private var nextIsNewStage: Bool {
        guard let i = index, sequence.indices.contains(i + 1) else { return false }
        return stageKey(activity) != stageKey(sequence[i + 1])
    }
    private func stageKey(_ activity: LearningActivity) -> String? {
        if let node = mission.allNodes.first(where: { $0.activityId == activity.rawValue }), node.station != "research" { return node.station }
        return course?.modules.first { $0.id == activity.rawValue }?.stage
    }
    private func move(_ delta: Int) {
        guard let i = index, sequence.indices.contains(i + delta) else { return }
        let next = sequence[i + delta]
        if delta > 0 && nextIsNewStage { onStage(next) } else { activity = next }
    }
}
