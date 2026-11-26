import SwiftUI

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
    @State private var openingFilm = false
    @State private var path: [String] = []
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
                        ExpeditionReceiptView(receipt: receipt, handoff: story.chapters.first { $0.id == receipt.chapterId }?.handoff ?? "", onContinue: { self.receipt = nil })
                    } else if let chapter { chapterHome(chapter) }
                    else { finish }
                } else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
            }.background(Color.expeditionNight).foregroundStyle(.white)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: String.self) { destination in
                    if let chapter = story.chapters.first(where: { destination.hasSuffix($0.id) }), let profile {
                        if destination.hasPrefix("work:") {
                            ExpeditionDeliveryView(story: story, chapter: chapter, mission: mission, profile: profile, store: store) { saved in
                                receipt = saved; path = []
                            }
                        } else {
                            ExpeditionLessonView(story: story, chapter: chapter, mission: mission, profile: profile, store: store) { path = ["work:" + chapter.id] }
                        }
                    }
                }
        }.tint(.expeditionGold).preferredColorScheme(.dark)
            .task { do { profile = try store.document(CrewProfile.key); loaded = true } catch { self.error = error.localizedDescription } }
            .sheet(isPresented: $editProfile) {
                NavigationStack { CrewIdentityView(story: story, existing: profile, onConfirm: saveProfile)
                    .navigationTitle("队员身份").navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { editProfile = false } } } }
                    .preferredColorScheme(.dark)
            }
            .sheet(isPresented: $archive) {
                NavigationStack {
                    List(receipts) { receipt in
                        NavigationLink { ExpeditionReceiptView(receipt: receipt, handoff: "", onContinue: nil) } label: {
                            HStack { CrewAvatar(profile: receipt.profile); VStack(alignment: .leading, spacing: 5) { Text(receipt.title); Text("\(receipt.profile.name) · \(receipt.work.artifacts.count) 份材料").font(.caption).foregroundStyle(.secondary) } }
                        }
                    }.navigationTitle("我的远航作品")
                        .overlay { if receipts.isEmpty { ContentUnavailableView("第一份作品正在等你", systemImage: "camera", description: Text("完成当前任务，作品会自动放在这里。")) } }
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { archive = false } } }
                }
            }
            .fullScreenCover(item: $film, onDismiss: afterFilm) { item in
                TabletFilmView(film: item, onContinue: { continueAfterFilm = true })
            }
            .alert("记录未保存", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private var header: some View {
        HStack(spacing: 16) {
            Button(action: onExit) { Label("我的项目", systemImage: "chevron.left") }.accessibilityIdentifier("ipad-exit-project")
            Text("/  星际远航").foregroundStyle(.white.opacity(0.5))
            Spacer()
            if let profile {
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
                    actionTitle: allRead ? "收好本章作品" : (draft.briefingSeen ? "继续当前任务" : "听林岚交代任务")) {
                        advance(chapter, draft: draft, allRead: allRead)
                    }
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
            if first { openingFilm = true; film = story.films.first { $0.id == story.openingFilmId } }
        } catch { self.error = error.localizedDescription }
    }
    private func advance(_ chapter: ExpeditionChapter, draft: ExpeditionDraft, allRead: Bool) {
        if allRead { path = ["work:" + chapter.id] }
        else if !draft.briefingSeen, let briefing = story.films.first(where: { $0.id == chapter.filmId }) {
            openingFilm = false; film = briefing
        } else { path = [(allRead ? "work:" : "lesson:") + chapter.id] }
    }
    private func afterFilm() {
        let enterTask = continueAfterFilm; continueAfterFilm = false
        if openingFilm { openingFilm = false; return }
        guard let chapter else { return }
        do {
            var draft = (try store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
            draft.briefingSeen = true; try store.saveDocument(draft, key: story.draftKey(chapter))
            if enterTask { path = ["lesson:" + chapter.id] }
        } catch { self.error = error.localizedDescription }
    }
}

private struct ExpeditionLessonView: View {
    let story: Expedition
    let chapter: ExpeditionChapter
    let mission: TabletMission
    let profile: CrewProfile
    @ObservedObject var store: LearningStore
    let onDelivery: () -> Void
    @State private var index = 0
    @State private var ready = false
    @State private var immersive = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss
    private var nodes: [TabletMissionNode] { chapter.nodes(mission) }
    private var node: TabletMissionNode { nodes[min(index, nodes.count - 1)] }
    private var canContinue: Bool { chapter.id == "first-contact" ? chapter.isReadyForDelivery(mission: mission, store: store) : mission.isRead(node, records: store.records) }
    var body: some View {
        VStack(spacing: 0) {
            if !immersive { HStack(spacing: 14) {
                CrewAvatar(profile: profile, size: 38)
                VStack(alignment: .leading, spacing: 3) { Text("\(profile.name) · \(chapter.title)").font(.subheadline.bold()); Text("步骤 \(index + 1) / \(nodes.count) · 最后收下「\(chapter.delivery.title)」").font(.caption).foregroundStyle(.white.opacity(0.65)) }
                Spacer()
                if index > 0 { Button("回看上一步") { move(-1) }.font(.caption) }
                Button(index == nodes.count - 1 ? "整理本章作品" : "继续下一步") { move(1) }.buttonStyle(.borderedProminent).tint(.expeditionGold).foregroundStyle(Color.expeditionNight).disabled(!canContinue).accessibilityIdentifier("expedition-next-step")
            }.padding(.horizontal, 20).padding(.vertical, 12).background(Color.expeditionNight).foregroundStyle(.white) }
            if ready {
                ClassroomView(activity: node.activity, store: store, crew: profile, onOpenActivity: { _ in error = "请先完成当前步骤。所有课程节点都会沿远航路线依次展开。" }, onMissionMap: { dismiss() }, onImmersiveChange: { immersive = $0 }).id(node.activityId)
            }
        }.navigationBarBackButtonHidden().toolbar(immersive ? .hidden : .visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button { dismiss() } label: { Label("远航任务", systemImage: "chevron.left") }.accessibilityIdentifier("ipad-lesson-back") } }
            .task {
                do { let draft = try store.document(story.draftKey(chapter), as: ExpeditionDraft.self); index = min(draft?.lessonIndex ?? 0, nodes.count - 1); ready = true }
                catch { self.error = error.localizedDescription }
            }
            .alert("任务提示", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("知道了") {} } message: { Text(error ?? "") }
    }
    private func move(_ delta: Int) {
        guard delta < 0 || canContinue else { return }
        if index + delta >= nodes.count { onDelivery(); return }
        do {
            var draft = (try store.document(story.draftKey(chapter), as: ExpeditionDraft.self)) ?? ExpeditionDraft()
            draft.lessonIndex = max(0, index + delta); try store.saveDocument(draft, key: story.draftKey(chapter)); index = draft.lessonIndex
        } catch { self.error = error.localizedDescription }
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
