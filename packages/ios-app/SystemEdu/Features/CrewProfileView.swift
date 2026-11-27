import SwiftUI

struct CrewFullPortrait: View {
    let profile: CrewProfile
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 24).fill(profile.role.crewAccent.opacity(0.12))
            if let data = profile.avatar, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFit()
                    .accessibilityLabel(profile.avatarFraming == "full-body-v1" ? "\(profile.name)的全身卡通形象" : "\(profile.name)的卡通形象")
            } else if let image = CrewArtwork.image(profile.role) {
                Image(uiImage: image).resizable().scaledToFit().padding(12)
            }
        }.aspectRatio(2.0 / 3.0, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 24))
            .accessibilityIdentifier("crew-full-portrait")
    }
}

struct CrewProfileView: View {
    let profile: CrewProfile
    let story: Expedition
    let chapter: ExpeditionChapter?
    let completed: Int
    let onSave: (CrewProfile) -> Void
    @Environment(\.dismiss) private var dismiss
    private var description: String {
        switch profile.role.id {
        case "engineer": return "你是队伍里把想法做出来的人。从一张草图到能工作的装置，每一次试验都在帮助远航更进一步。"
        case "navigator": return "你负责把发现连成路线。整理线索、比较方案，再和队员一起决定下一步，让每一份成果都有去处。"
        default: return "你负责发现那些容易被忽略的变化。把看到的现象记录下来，用证据追问原因，为整支队伍带回新的线索。"
        }
    }
    private var strengths: [String] {
        switch profile.role.id {
        case "engineer": return ["动手验证", "调整方案", "留下原型"]
        case "navigator": return ["整理线索", "连接步骤", "交接成果"]
        default: return ["留意变化", "提出问题", "记录证据"]
        }
    }
    var body: some View {
        ScrollView {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 32) {
                    CrewFullPortrait(profile: profile).frame(width: 300).accessibilityIdentifier("crew-profile-portrait")
                    details.frame(width: 370)
                }
                VStack(alignment: .leading, spacing: 26) {
                    CrewFullPortrait(profile: profile).frame(maxWidth: 300).frame(maxWidth: .infinity).accessibilityIdentifier("crew-profile-portrait")
                    details
                }
            }.padding(28).frame(maxWidth: .infinity)
        }.background(Color.expeditionNight).foregroundStyle(.white)
            .navigationTitle("我的队员档案").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
    }
    private var details: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("星际远航 / CREW FILE").font(.caption.bold()).tracking(2).foregroundStyle(profile.role.crewAccent)
            VStack(alignment: .leading, spacing: 8) {
                Text(profile.name).font(.system(size: 36, weight: .bold)).accessibilityIdentifier("crew-profile-name")
                Text(profile.role.title).font(.title3.bold()).foregroundStyle(profile.role.crewAccent)
                Text(profile.role.duty).font(.subheadline).foregroundStyle(.white.opacity(0.65))
            }
            Text(description).font(.body).lineSpacing(6)
            HStack(spacing: 8) {
                ForEach(strengths, id: \.self) { value in Text(value).font(.caption.bold()).padding(.horizontal, 10).padding(.vertical, 8).background(profile.role.crewAccent.opacity(0.12), in: Capsule()) }
            }
            VStack(alignment: .leading, spacing: 12) {
                Label("现在的任务", systemImage: "location.fill").font(.caption.bold()).foregroundStyle(.white.opacity(0.55))
                Text(chapter?.title ?? "远航成果已交接").font(.headline)
                Text("已留下 \(completed) 份署名作品").font(.subheadline).foregroundStyle(profile.role.crewAccent)
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 18))
            NavigationLink {
                CrewIdentityView(story: story, existing: profile, onConfirm: onSave)
                    .navigationTitle("调整队员形象").navigationBarTitleDisplayMode(.inline)
            } label: {
                Label(profile.avatarFraming == "full-body-v1" ? "调整我的形象" : "设计我的全身形象", systemImage: "person.crop.rectangle")
                    .font(.headline).frame(maxWidth: .infinity).padding(16)
                    .background(Color.expeditionGold, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(Color.expeditionNight)
            }.accessibilityIdentifier("crew-profile-edit")
        }
    }
}
