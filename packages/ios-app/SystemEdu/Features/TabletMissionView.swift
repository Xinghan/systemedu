import SwiftUI

private enum ExpeditionRoute: Hashable {
    case lesson(chapter: String, node: String?)
    case work(chapter: String)
    var chapterID: String {
        switch self { case .lesson(let chapter, _), .work(let chapter): return chapter }
    }
}
private enum ExpeditionFilmIntent {
    case opening, chapter(String, String?), replay
}

struct TabletMissionView: View {
    @ObservedObject var store: LearningStore
    let mission: TabletMission
    var onExit: () -> Void = {}
    var body: some View {
        if let story = Expedition.current {
            ExpeditionJourneyView(store: store, mission: mission, story: story, onExit: onExit)
        } else {
            ContentUnavailableView("远航资料暂时未准备好", systemImage: "shippingbox", description: Text("请重新安装完整的本地资源包。"))
                .overlay(alignment: .topLeading) { Button("我的项目", action: onExit).padding() }
        }
    }
}

private struct ExpeditionJourneyView: View {
    @ObservedObject var store: LearningStore
    let mission: TabletMission
    let story: Expedition
    let onExit: () -> Void
    @State private var profile: CrewProfile?
    @State private var loaded = false
    @State private var editProfile = false
    @State private var film: TabletFilm?
    @State private var continueAfterFilm = false
    @State private var filmIntent: ExpeditionFilmIntent = .replay
    @State private var path: [ExpeditionRoute] = []
    @State private var routeMap = false
    @State private var selectedReview: (ExpeditionChapter, TabletMissionNode)?
    @State private var error: String?
    @State private var archive = false
    @State private var receipt: ExpeditionReceipt?
    private var chapter: ExpeditionChapter? { story.currentChapter(store: store) }
    private var receipts: [ExpeditionReceipt] { story.chapters.compactMap { try? store.document(story.receiptKey($0), as: ExpeditionReceipt.self) } }
    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                header
                if loaded {
                    if profile == nil { CrewIdentityView(story: story, onConfirm: saveProfile) }
                    else if let receipt {
                        ExpeditionReceiptView(receipt: receipt, handoff: story.chapters.first { $0.id == receipt.chapterId }?.handoff ?? "", onContinue: { self.receipt = nil },
                            completionFilm: story.completionFilms?[receipt.chapterId], autoPlayCompletion: true,
                            nextChapterTitle: chapter?.title)
                    } else if let chapter { chapterHome(chapter) }
                    else { finish }
                } else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
            }.background(Color.expeditionNight).foregroundStyle(.white)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: ExpeditionRoute.self) { destination in
                    if let chapter = story.chapters.first(where: { $0.id == destination.chapterID }), let profile {
                        switch destination {
                        case .work:
                            ExpeditionDeliveryView(story: story, chapter: chapter, mission: mission, profile: profile, store: store) { saved in
                                receipt = saved; path = []
                            }.id(destination)
                        case .lesson(_, let ref):
                            ExpeditionLessonView(story: story, chapter: chapter, mission: mission, profile: profile, store: store, initialRef: ref,
                                onOpenNode: openNode) {
                                    if (try? store.document(story.receiptKey(chapter), as: ExpeditionReceipt.self)) != nil { path = [] }
                                    else { path = [.work(chapter: chapter.id)] }
                                }.id(destination)
                        }
                    }
                }
        }.tint(.expeditionGold).preferredColorScheme(.dark)
            .task { do { profile = try store.document(CrewProfile.key); loaded = true } catch { self.error = error.localizedDescription } }
            .fullScreenCover(isPresented: $editProfile) {
                NavigationStack {
                    if let profile {
                        CrewProfileView(profile: profile, story: story, chapter: chapter, completed: receipts.count, onSave: saveProfile)
                    }
                }
                    .preferredColorScheme(.dark)
            }
            .sheet(isPresented: $archive) {
                NavigationStack {
                    List(receipts) { receipt in
                        NavigationLink { ExpeditionReceiptView(receipt: receipt, handoff: "", onContinue: nil, completionFilm: story.completionFilms?[receipt.chapterId]) } label: {
                            HStack { CrewAvatar(profile: receipt.profile); VStack(alignment: .leading, spacing: 5) { Text(receipt.title); Text("\(receipt.profile.name) · \(receipt.work.artifacts.count) 份材料").font(.caption).foregroundStyle(.secondary) } }
                        }
                    }.navigationTitle("我的远航作品")
                        .overlay { if receipts.isEmpty { ContentUnavailableView("第一份作品正在等你", systemImage: "camera", description: Text("完成当前任务，作品会自动放在这里。")) } }
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { archive = false } } }
                }
            }
            .sheet(isPresented: $routeMap, onDismiss: {
                if let (owner, node) = selectedReview { selectedReview = nil; openNode(owner, node) }
            }) {
                ExpeditionRouteMap(story: story, mission: mission, store: store, selectedRef: nil) { owner, node in selectedReview = (owner, node); routeMap = false }
            }
            .fullScreenCover(item: $film, onDismiss: afterFilm) { item in
                TabletFilmView(film: item, continueTitle: filmContinueTitle, onContinue: { continueAfterFilm = true })
            }
            .alert("记录未保存", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private var header: some View {
        HStack(spacing: 16) {
            Button(action: onExit) { Label("我的项目", systemImage: "chevron.left") }.accessibilityIdentifier("ipad-exit-project")
            Text("/  星际远航").foregroundStyle(.white.opacity(0.5))
            Spacer()
            Button { replayOpening() } label: { Label("项目介绍", systemImage: "play.rectangle") }
                .accessibilityIdentifier("expedition-project-film")
            if let profile {
                Button { routeMap = true } label: { Label("任务地图", systemImage: "map") }.accessibilityIdentifier("expedition-route-map")
                Button { archive = true } label: { Label("\(receipts.count) 份作品", systemImage: "tray.full") }.accessibilityIdentifier("expedition-archive")
                Button { editProfile = true } label: { HStack(spacing: 10) { Text(profile.name).font(.subheadline.bold()); CrewAvatar(profile: profile, size: 36) } }.accessibilityIdentifier("crew-edit")
            }
        }.font(.subheadline).padding(.horizontal, 26).frame(height: 66).background(Color.expeditionNight)
    }
    private func chapterHome(_ chapter: ExpeditionChapter) -> some View {
        let draft = (try? store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
        let allRead = chapter.isReadyForDelivery(mission: mission, store: store)
        return Group {
            if let profile {
                ExpeditionHomeView(story: story, mission: mission, chapter: chapter, profile: profile, completed: receipts.count,
                    actionTitle: allRead ? "收好本章作品" : (draft.briefingSeen ? "继续当前任务" : "听林岚交代任务"), onOpenProfile: { editProfile = true },
                    onReviewChapter: { item in if let node = item.nodes(mission).first { openNode(item, node) } },
                    onReplayBriefing: { filmIntent = .replay; film = story.films.first { $0.id == chapter.filmId } }) {
                        advance(chapter, draft: draft, allRead: allRead)
                    }.id(chapter.id)
            }
        }
    }
    private var finish: some View {
        VStack(spacing: 24) { CrewAvatar(profile: profile, size: 120); Text("\(profile?.name ?? "队员")，远航档案已交接。").font(.largeTitle.bold()); Text("14 章的作品，都留在你的名字之下。").foregroundStyle(.white.opacity(0.7)); Button("回看我的作品") { archive = true }.buttonStyle(.borderedProminent) }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    private func saveProfile(_ value: CrewProfile) {
        do {
            let first = profile == nil
            try store.saveDocument(value, key: CrewProfile.key); profile = value; editProfile = false
            if first { filmIntent = .opening; film = story.films.first { $0.id == story.openingFilmId } }
        } catch { self.error = error.localizedDescription }
    }
    private func advance(_ chapter: ExpeditionChapter, draft: ExpeditionDraft, allRead: Bool) {
        if allRead { path = [.work(chapter: chapter.id)] }
        else if !draft.briefingSeen, let briefing = story.films.first(where: { $0.id == chapter.filmId }) {
            filmIntent = .chapter(chapter.id, nil); film = briefing
        } else { path = [.lesson(chapter: chapter.id, node: nil)] }
    }
    private var filmContinueTitle: String {
        switch filmIntent { case .chapter: return "进入任务"; case .opening, .replay: return "返回任务中心" }
    }
    private func replayOpening() {
        filmIntent = .replay; continueAfterFilm = false
        film = story.films.first { $0.id == story.openingFilmId }
    }
    private func openNode(_ chapter: ExpeditionChapter, _ node: TabletMissionNode) {
        guard story.canVisit(node, in: chapter, mission: mission, store: store) else { return }
        let draft = (try? store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
        let archived = (try? store.document(story.receiptKey(chapter), as: ExpeditionReceipt.self)) != nil
        if !archived, !draft.briefingSeen, let briefing = story.films.first(where: { $0.id == chapter.filmId }) {
            filmIntent = .chapter(chapter.id, node.ref)
            film = briefing
            return
        }
        receipt = nil; path = [.lesson(chapter: chapter.id, node: node.ref)]
    }
    private func afterFilm() {
        let enterTask = continueAfterFilm; continueAfterFilm = false
        guard case .chapter(let id, let ref) = filmIntent, let chapter = story.chapters.first(where: { $0.id == id }) else { return }
        filmIntent = .replay
        do {
            var draft = (try store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
            draft.briefingSeen = true; try store.saveDocument(draft, key: story.draftKey(chapter))
            if enterTask { path = [.lesson(chapter: chapter.id, node: ref)] }
        } catch { self.error = error.localizedDescription }
    }
}

private struct ExpeditionLessonView: View {
    let story: Expedition
    let chapter: ExpeditionChapter
    let mission: TabletMission
    let profile: CrewProfile
    @ObservedObject var store: LearningStore
    let initialRef: String?
    let onOpenNode: (ExpeditionChapter, TabletMissionNode) -> Void
    let onDelivery: () -> Void
    @State private var index = 0
    @State private var ready = false
    @State private var immersive = false
    @State private var completedLessonTitle: String?
    @State private var error: String?
    @State private var routeMap = false
    @State private var selectedReview: (ExpeditionChapter, TabletMissionNode)?
    @Environment(\.dismiss) private var dismiss
    private var nodes: [TabletMissionNode] { chapter.nodes(mission) }
    private var node: TabletMissionNode { nodes[min(index, nodes.count - 1)] }
    @State private var replayFilm: TabletFilm?
    private var canContinue: Bool { chapter.id == "first-contact" ? chapter.isReadyForDelivery(mission: mission, store: store) : mission.isRead(node, records: store.records) }
    private var archived: Bool { (try? store.document(story.receiptKey(chapter), as: ExpeditionReceipt.self)) != nil }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button { dismiss() } label: { Label("项目首页", systemImage: "chevron.left").font(.subheadline).frame(minHeight: 44) }
                    .accessibilityIdentifier("ipad-lesson-back")
                VStack(alignment: .leading, spacing: 5) {
                    Text(node.title).font(.system(size: 16, weight: .semibold)).lineLimit(1)
                        .accessibilityIdentifier("expedition-lesson-title")
                    Text("\(chapter.title) · 本章第 \(index + 1) / \(nodes.count) 节").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                        .accessibilityIdentifier("expedition-lesson-position")
                }
                Spacer(minLength: 8)
                Menu {
                    Button("项目介绍") { replayFilm = story.films.first { $0.id == story.openingFilmId } }
                    Button("本章开场") { replayFilm = story.films.first { $0.id == chapter.filmId } }
                    if archived, let closing = story.completionFilms?[chapter.id] { Button("本章收尾") { replayFilm = closing } }
                } label: { Image(systemName: "play.rectangle").frame(width: 44, height: 44) }.accessibilityLabel("介绍与收尾视频").accessibilityIdentifier("expedition-lesson-films")
                Button { routeMap = true } label: { Label("任务地图", systemImage: "map").font(.subheadline).frame(minHeight: 44) }.accessibilityIdentifier("expedition-lesson-map")
                if previousNode != nil {
                    Button { reviewPrevious() } label: { Image(systemName: "arrow.uturn.backward").frame(width: 44, height: 44) }
                        .accessibilityLabel("回看上一节").accessibilityIdentifier("expedition-previous-lesson")
                }
                Button { move(1) } label: {
                    Label(index == nodes.count - 1 ? (archived ? "返回任务中心" : "整理本章作品") : "进入第 \(index + 2) 节", systemImage: "arrow.right")
                        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 18).frame(minHeight: 44)
                        .foregroundStyle(canContinue ? Color.expeditionNight : Color.white.opacity(0.48))
                        .background(canContinue ? Color.expeditionGold : Color.white.opacity(0.07), in: Capsule())
                }.buttonStyle(.plain).disabled(!canContinue).accessibilityIdentifier("expedition-next-step")
            }.padding(.horizontal, 16).padding(.vertical, 8).background(Color.expeditionNight).foregroundStyle(.white)
            if !immersive, let completedLessonTitle {
                Label("已完成「\(completedLessonTitle)」 · 已进入本章第 \(index + 1) 节", systemImage: "checkmark.circle.fill")
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(Color.expeditionGold)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).padding(.vertical, 10)
                    .background(Color.white.opacity(0.04)).accessibilityElement(children: .combine).accessibilityIdentifier("expedition-lesson-transition")
            }
            if ready {
                ClassroomView(activity: node.activity, store: store, crew: profile, embeddedInMission: true,
                    onOpenActivity: { activity in
                        if let target = mission.allNodes.first(where: { $0.activity == activity }), let owner = story.chapters.first(where: { $0.refs.contains(target.ref) }), story.canVisit(target, in: owner, mission: mission, store: store) { onOpenNode(owner, target) }
                        else { error = "完成当前任务后，就能进入下一节点。你可以从任务地图回看已学内容。" }
                    }, onMissionMap: { routeMap = true },
                    missionContinueLabel: index == nodes.count - 1 ? (archived ? "返回任务中心" : "完成本节，整理本章作品") : "完成本节，进入「\(nodes[index + 1].title)」",
                    onAdvance: { activity in
                        guard activity == node.activity else { throw StoreError.invalidState }
                        if chapter.id == "first-contact", !canContinue { throw ExpeditionNavigationError.photoRequired }
                        try advanceLesson()
                    }, onImmersiveChange: { immersive = $0 }).id(node.activityId)
            }
        }.background(Color.expeditionNight).navigationBarBackButtonHidden().toolbar(.hidden, for: .navigationBar)
            .task {
                guard !ready else { return }
                index = chapter.resumeLessonIndex(mission: mission, store: store)
                if let initialRef, let selected = nodes.firstIndex(where: { $0.ref == initialRef }), story.canVisit(nodes[selected], in: chapter, mission: mission, store: store) { index = selected }
                ready = true
            }
            .sheet(isPresented: $routeMap, onDismiss: {
                if let (owner, target) = selectedReview {
                    selectedReview = nil
                    if owner.id == chapter.id, let selected = nodes.firstIndex(where: { $0.ref == target.ref }) {
                        index = selected; immersive = false; completedLessonTitle = nil
                    } else { onOpenNode(owner, target) }
                }
            }) {
                ExpeditionRouteMap(story: story, mission: mission, store: store, selectedRef: node.ref) { owner, target in selectedReview = (owner, target); routeMap = false }
            }
            .fullScreenCover(item: $replayFilm) { TabletFilmView(film: $0, continueTitle: "返回本节", onContinue: {}) }
            .alert("任务提示", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private var previousNode: (ExpeditionChapter, TabletMissionNode)? {
        if index > 0 { return (chapter, nodes[index - 1]) }
        guard let position = story.chapters.firstIndex(where: { $0.id == chapter.id }), position > 0,
              let target = story.chapters[position - 1].nodes(mission).last else { return nil }
        let owner = story.chapters[position - 1]
        return story.canVisit(target, in: owner, mission: mission, store: store) ? (owner, target) : nil
    }
    private func reviewPrevious() {
        guard let (owner, target) = previousNode else { return }
        if owner.id == chapter.id { index -= 1; immersive = false; completedLessonTitle = nil }
        else { onOpenNode(owner, target) }
    }
    private func move(_ delta: Int) {
        guard delta < 0 || canContinue else { return }
        do {
            if delta > 0 { try advanceLesson(); return }
            reviewPrevious()
        } catch { self.error = error.localizedDescription }
    }
    private func advanceLesson() throws {
        guard canContinue else { throw StoreError.invalidState }
        if index + 1 >= nodes.count { onDelivery(); return }
        var draft = (try store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
        draft.lessonIndex = index + 1
        try store.saveDocument(draft, key: story.draftKey(chapter))
        completedLessonTitle = node.title
        immersive = false
        index = draft.lessonIndex
    }
}
private struct ExpeditionRouteMap: View {
    let story: Expedition
    let mission: TabletMission
    @ObservedObject var store: LearningStore
    let selectedRef: String?
    let onSelect: (ExpeditionChapter, TabletMissionNode) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var expanded: Set<String> = []
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("回看不会改变你的进度。完成当前节点后，下一节点会沿路线解锁。").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(Array(story.chapters.enumerated()), id: \.element.id) { position, chapter in
                    let archived = (try? store.document(story.receiptKey(chapter), as: ExpeditionReceipt.self)) != nil
                    DisclosureGroup(isExpanded: Binding(get: { expanded.contains(chapter.id) }, set: { if $0 { expanded.insert(chapter.id) } else { expanded.remove(chapter.id) } })) {
                        ForEach(Array(chapter.nodes(mission).enumerated()), id: \.element.ref) { index, node in
                            let available = story.canVisit(node, in: chapter, mission: mission, store: store)
                            let read = archived || mission.isRead(node, records: store.records)
                            Button { onSelect(chapter, node) } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: node.ref == selectedRef ? "location.fill" : available ? (read ? "checkmark.circle.fill" : "play.circle") : "lock.fill")
                                        .foregroundStyle(available ? Color.expeditionGold : .secondary)
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text("\(index + 1). \(node.title)").foregroundStyle(available ? .primary : .secondary)
                                        Text(node.ref == selectedRef ? "正在查看" : !available ? "完成前面的任务后解锁" : read ? "已学 · 可以回看" : "当前任务").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }.frame(minHeight: 44)
                            }.disabled(!available).accessibilityIdentifier("expedition-route-" + node.ref)
                        }
                    } label: {
                        HStack(spacing: 12) {
                            BundledMissionImage(path: chapter.image).frame(width: 62, height: 48).clipShape(RoundedRectangle(cornerRadius: 8))
                            VStack(alignment: .leading, spacing: 5) {
                                Text("\(position + 1). \(chapter.title)").font(.headline)
                                Text("\(chapter.refs.count) 个节点 · \(chapter.delivery.title)").font(.caption).foregroundStyle(.secondary)
                            }
                        }.padding(.vertical, 4)
                    }
                }
            }.navigationTitle("远航任务地图").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("关闭") { dismiss() }.accessibilityIdentifier("expedition-close-map") } }
                .task {
                    if let chapter = story.chapters.first(where: { $0.refs.contains(selectedRef ?? "") }) ?? story.currentChapter(store: store) { expanded.insert(chapter.id) }
                }
        }.tint(.expeditionGold).preferredColorScheme(.dark)
    }
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
