import SwiftUI

struct ExpeditionHomeView: View {
    let story: Expedition
    let mission: TabletMission
    let chapter: ExpeditionChapter
    let profile: CrewProfile
    let completed: Int
    let actionTitle: String
    let onContinue: () -> Void
    private var current: Int { story.chapters.firstIndex { $0.id == chapter.id } ?? 0 }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                introduction
                currentTask
                if let overview = story.overview {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack { Label("远航任务地图", systemImage: "map").font(.title2.bold()); Spacer(); Text("\(completed) / \(story.chapters.count) 章已入档").font(.subheadline).foregroundStyle(Color.expeditionGold) }
                        Text("从观测到研究，再把判断变成行动。每一站带走成果，才进入下一站。").font(.subheadline).foregroundStyle(.white.opacity(0.7))
                        Text("标着「现在出发」的卡片可以进入当前任务。").font(.caption).foregroundStyle(.white.opacity(0.6))
                    }.accessibilityIdentifier("expedition-map-introduction")
                    ForEach(Array(overview.acts.enumerated()), id: \.element.id) { index, act in
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(alignment: .top, spacing: 16) {
                                Image(systemName: act.symbol).font(.title2).foregroundStyle(Color.expeditionGold).frame(width: 44, height: 44).background(Color.expeditionGold.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("\(String(format: "%02d", index + 1)) / \(act.title)").font(.headline)
                                    Text(act.summary).font(.subheadline).foregroundStyle(.white.opacity(0.7))
                                }
                            }
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 185, maximum: 270), spacing: 14)], alignment: .leading, spacing: 14) {
                                ForEach(story.chapters.filter { act.chapters.contains($0.id) }) { item in
                                    if item.id == chapter.id {
                                        Button(action: onContinue) { mapCard(item) }.buttonStyle(.plain)
                                            .accessibilityLabel("进入当前任务：" + item.title).accessibilityIdentifier("expedition-map-current")
                                    } else { mapCard(item).accessibilityElement(children: .combine).accessibilityIdentifier("expedition-stop-" + item.id) }
                                }
                            }
                        }.padding(20).background(Color.expeditionPanel.opacity(0.65), in: RoundedRectangle(cornerRadius: 22))
                    }
                    Label("最终交付：" + story.goal, systemImage: "tray.full.fill").font(.headline).foregroundStyle(Color.expeditionGold)
                    Text(overview.boundary).font(.callout).lineSpacing(5).foregroundStyle(.white.opacity(0.65))
                }
                Text("场景为故事插画；观测与试验结果来自你的实际操作。所有身份沿同一条任务路线前进。").font(.caption).foregroundStyle(.white.opacity(0.45))
            }.padding(.horizontal, 26).padding(.bottom, 34).frame(maxWidth: 1200).frame(maxWidth: .infinity)
        }
    }
    private var introduction: some View {
        ZStack(alignment: .leading) {
            BundledMissionImage(path: mission.homeImage)
            LinearGradient(colors: [.expeditionNight.opacity(0.94), .expeditionNight.opacity(0.75), .expeditionNight.opacity(0.3)], startPoint: .leading, endPoint: .trailing)
            HStack(alignment: .center, spacing: 26) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("SYSTEMEDU / 远航任务档案").font(.caption.bold()).tracking(3).foregroundStyle(Color.expeditionGold)
                    Text("星际远航").font(.system(size: 36, weight: .bold))
                    Text(story.overview?.question ?? story.goal).font(.title3.bold()).accessibilityIdentifier("expedition-overview-question")
                    Text(story.overview?.summary ?? story.subtitle).font(.subheadline).lineSpacing(5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 20) {
                        Label("14 章连续任务", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                        Label("14 份署名成果", systemImage: "checkmark.seal")
                    }.font(.caption).foregroundStyle(Color.expeditionGold)
                }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(spacing: 12) {
                    CrewAvatar(profile: profile, size: 96)
                    Text(profile.name).font(.title3.bold())
                    Text(profile.role.title).font(.subheadline).foregroundStyle(Color.expeditionGold)
                    Text(profile.role.duty).font(.caption).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.75))
                }.frame(width: 150).padding(.vertical, 22).background(Color.expeditionNight.opacity(0.7), in: RoundedRectangle(cornerRadius: 22))
            }.padding(28)
        }.frame(minHeight: 290).clipShape(RoundedRectangle(cornerRadius: 26))
    }
    private var currentTask: some View {
        Button(action: onContinue) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 24) { taskImage.frame(width: 240, height: 210); taskCopy.frame(minWidth: 370, maxWidth: .infinity, alignment: .leading) }
                VStack(alignment: .leading, spacing: 18) { taskImage.frame(height: 185); taskCopy }
            }.padding(22).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 22))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.expeditionGold.opacity(0.55), lineWidth: 1))
        }.buttonStyle(.plain).accessibilityIdentifier("expedition-continue")
    }
    private var taskImage: some View {
        BundledMissionImage(path: chapter.image).clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .topLeading) { Label("当前任务", systemImage: "location.fill").font(.caption.bold()).padding(9).background(Color.expeditionNight.opacity(0.88), in: Capsule()).padding(10) }
    }
    private var taskCopy: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("第 \(current + 1) 章 / \(chapter.act)").font(.caption.bold()).foregroundStyle(Color.expeditionGold)
            Text(chapter.title).font(.title2.bold()).accessibilityIdentifier("expedition-chapter-title")
            Text(chapter.arrival).font(.subheadline).lineSpacing(4).foregroundStyle(.white.opacity(0.75))
            Label("带走：" + chapter.delivery.title, systemImage: "shippingbox").font(.subheadline).foregroundStyle(.white.opacity(0.9))
            HStack { Text(actionTitle); Image(systemName: "arrow.right") }.font(.headline).padding(.horizontal, 20).padding(.vertical, 12).foregroundStyle(Color.expeditionNight).background(Color.expeditionGold, in: Capsule())
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func mapCard(_ item: ExpeditionChapter) -> some View {
        let index = story.chapters.firstIndex { $0.id == item.id } ?? 0
        let isCurrent = item.id == chapter.id
        return VStack(alignment: .leading, spacing: 9) {
            BundledMissionImage(path: item.image).frame(height: 105).clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(alignment: .topLeading) {
                    Label(index < current ? "已入档" : isCurrent ? "现在出发" : "依次解锁", systemImage: index < current ? "checkmark.circle.fill" : isCurrent ? "arrow.right.circle.fill" : "lock.fill")
                        .font(.caption2.bold()).padding(7).background(isCurrent ? Color.expeditionGold : Color.expeditionNight.opacity(0.9), in: Capsule()).foregroundStyle(isCurrent ? Color.expeditionNight : .white).padding(7)
                }
            Text(String(format: "%02d", index + 1) + "  " + item.title).font(.subheadline.bold()).fixedSize(horizontal: false, vertical: true)
            Text("收获 · " + item.delivery.title).font(.caption).lineSpacing(3).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
        }.padding(10).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(isCurrent ? Color.expeditionGold.opacity(0.09) : Color.expeditionNight.opacity(0.4), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(isCurrent ? Color.expeditionGold : .white.opacity(0.07), lineWidth: isCurrent ? 2 : 1))
    }
}
