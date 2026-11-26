import SwiftUI
import PhotosUI
import ImageIO

private enum AvatarFailure: LocalizedError {
    case unavailable, failed, image
    var errorDescription: String? {
        switch self {
        case .unavailable: return "形象服务暂时不可用。可以重试，或先使用队徽加入；稍后仍可补上照片形象。"
        case .failed: return "这次形象没有生成成功。照片仍在当前预览中，可以重新生成。"
        case .image: return "这张照片无法读取，请换一张清晰的单人照片。"
        }
    }
}

enum CrewImage {
    static func jpeg(_ data: Data, side: Int = 1024) -> Data? {
        guard data.count <= 20_000_000, let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceThumbnailMaxPixelSize: side, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { return nil }
        return UIImage(cgImage: cg).jpegData(compressionQuality: 0.85)
    }
}

enum AvatarService {
    static var endpoint: URL? {
        #if DEBUG && targetEnvironment(simulator)
        return URL(string: "http://127.0.0.1:8769")
        #else
        return nil // Public/device rollout needs an authenticated HTTPS service first.
        #endif
    }
    static func generate(_ photo: Data) async throws -> Data {
        guard let base = endpoint else { throw AvatarFailure.unavailable }
        let id = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        let job = base.appendingPathComponent("avatars/" + id)
        defer {
            Task { var request = URLRequest(url: job); request.httpMethod = "DELETE"; request.timeoutInterval = 10; _ = try? await URLSession.shared.data(for: request) }
        }
        var request = URLRequest(url: base.appendingPathComponent("avatars"))
        request.httpMethod = "POST"; request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["requestId": id, "image": photo.base64EncodedString()])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 202 else { throw AvatarFailure.unavailable }
        for _ in 0..<150 {
            try Task.checkCancellation()
            try await Task.sleep(for: .seconds(2))
            var poll = URLRequest(url: job); poll.timeoutInterval = 15; poll.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: poll)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw AvatarFailure.failed }
            if value["status"] as? String == "failed" { throw AvatarFailure.failed }
            if value["status"] as? String == "ready" {
                guard let image = value["image"] as? String, let bytes = Data(base64Encoded: image),
                      let final = CrewImage.jpeg(bytes, side: 640) else { throw AvatarFailure.image }
                return final
            }
        }
        throw AvatarFailure.failed
    }
}

struct CrewAvatar: View {
    let profile: CrewProfile?
    var size: CGFloat = 46
    var body: some View {
        Group {
            if let data = profile?.avatar, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                ZStack { Color(red: 0.12, green: 0.23, blue: 0.33); Image(systemName: profile?.role.symbol ?? "sparkles").font(.system(size: size * 0.36)).foregroundStyle(Color.expeditionGold) }
            }
        }.frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: size * 0.28))
            .overlay(RoundedRectangle(cornerRadius: size * 0.28).stroke(.white.opacity(0.25)))
            .accessibilityLabel(profile.map { "\($0.name)的\($0.avatar == nil ? "队徽" : "卡通形象")" } ?? "队员形象")
    }
}

extension Color {
    static let expeditionNight = Color(red: 0.035, green: 0.065, blue: 0.105)
    static let expeditionPanel = Color(red: 0.075, green: 0.12, blue: 0.18)
    static let expeditionGold = Color(red: 1, green: 0.76, blue: 0.42)
}

struct CrewIdentityView: View {
    let story: Expedition
    let existing: CrewProfile?
    let onConfirm: (CrewProfile) -> Void
    @State private var name: String
    @State private var roleID: String
    @State private var picker: PhotosPickerItem?
    @State private var photo: Data?
    @State private var avatar: Data?
    @State private var generating = false
    @State private var loadingPhoto = false
    @State private var error: String?
    @State private var generation: Task<Void, Never>?
    @State private var selectionVersion = UUID()
    init(story: Expedition, existing: CrewProfile? = nil, onConfirm: @escaping (CrewProfile) -> Void) {
        self.story = story; self.existing = existing; self.onConfirm = onConfirm
        _name = State(initialValue: existing?.name ?? "")
        _roleID = State(initialValue: existing?.role.id ?? story.roles[0].id)
        _avatar = State(initialValue: existing?.avatar)
    }
    private var role: ExpeditionRole { story.roles.first { $0.id == roleID } ?? story.roles[0] }
    private var preview: CrewProfile { CrewProfile(name: name, role: role, avatar: avatar) }
    var body: some View {
        ScrollView {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 34) { portrait.frame(width: 310); form.frame(width: 510) }
                VStack(spacing: 28) { portrait; form }
            }.padding(32).frame(maxWidth: .infinity)
        }.background(Color.expeditionNight).foregroundStyle(.white).tint(.expeditionGold)
            .task(id: picker) { await loadPhoto() }
            .onDisappear { generation?.cancel(); photo = nil }
    }
    private var portrait: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("星际远航 / 入队登记").font(.caption.weight(.semibold)).tracking(3).foregroundStyle(Color.expeditionGold)
            Text(existing == nil ? "这一次，\n你在故事里。" : "你的远航身份").font(.system(size: 38, weight: .bold)).lineSpacing(6)
            ZStack {
                RoundedRectangle(cornerRadius: 28).fill(Color.expeditionPanel)
                if let image = avatar.flatMap(UIImage.init(data:)) {
                    Image(uiImage: image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 28))
                } else if let image = photo.flatMap(UIImage.init(data:)) {
                    Image(uiImage: image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 28))
                } else { CrewAvatar(profile: preview, size: 150) }
                if generating { Color.black.opacity(0.55).clipShape(RoundedRectangle(cornerRadius: 28)); ProgressView("正在设计你的动画形象…").tint(.white) }
            }.frame(height: 310).accessibilityIdentifier("crew-avatar-preview")
            Text(name.isEmpty ? "等待你的名字" : "\(name) · \(role.title)").font(.title2.bold())
            Text("你的名字和形象会出现在任务简报、课堂和每一份署名作品上。").font(.callout).foregroundStyle(.white.opacity(0.7)).lineSpacing(5)
        }
    }
    private var form: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 9) {
                Text("01  大家怎么称呼你").font(.headline)
                TextField("你的队员名", text: $name).textFieldStyle(.plain).padding(15).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("crew-name")
                    .onChange(of: name) { _, value in if value.count > 20 { name = String(value.prefix(20)) } }
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("02  选择你的队员身份").font(.headline)
                Text("我们是同一支队伍，一起完成这次远航。").font(.subheadline).foregroundStyle(.white.opacity(0.65))
                HStack(spacing: 10) {
                    ForEach(story.roles) { item in
                        Button { roleID = item.id } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Image(systemName: item.symbol).font(.title2)
                                Text(item.title).font(.headline)
                                Text(item.duty).font(.caption).fixedSize(horizontal: false, vertical: true)
                            }.frame(maxWidth: .infinity, minHeight: 100, alignment: .leading).padding(13)
                                .foregroundStyle(roleID == item.id ? Color.expeditionNight : .white)
                                .background(roleID == item.id ? Color.expeditionGold : Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 15))
                        }.buttonStyle(.plain).accessibilityIdentifier("crew-role-" + item.id).accessibilityAddTraits(roleID == item.id ? .isSelected : [])
                    }
                }
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("03  照片变成动画形象 · 可选").font(.headline)
                HStack(spacing: 18) {
                    PhotosPicker(selection: $picker, matching: .images) { Label(photo == nil ? "选择一张照片" : "更换照片", systemImage: "photo") }.disabled(generating).accessibilityIdentifier("crew-choose-photo")
                    if photo != nil {
                        Button(avatar == nil ? "生成动画形象" : "重新生成") { generate() }.disabled(generating || loadingPhoto).accessibilityIdentifier("crew-generate")
                    }
                    if avatar != nil || photo != nil {
                        Button("使用队徽") { generation?.cancel(); selectionVersion = UUID(); generating = false; photo = nil; avatar = nil; picker = nil; error = nil }.font(.caption)
                    }
                }.frame(minHeight: 44)
                if loadingPhoto { ProgressView("正在读取照片…") }
                Text("选择照片只在本机预览。点击生成后，照片会发送至通义图像服务进行重绘，服务方按其规则处理。本机只保存你确认的动画形象，不保存原照片。").font(.caption).foregroundStyle(.white.opacity(0.62)).lineSpacing(4)
                if let error { Text(error).font(.callout).foregroundStyle(Color.expeditionGold).accessibilityIdentifier("crew-error") }
            }
            Button {
                generation?.cancel(); photo = nil
                onConfirm(CrewProfile(name: name.trimmingCharacters(in: .whitespacesAndNewlines), role: role, avatar: avatar))
            } label: {
                HStack { Text(existing == nil ? (avatar == nil ? "以队徽身份加入远航" : "确认形象，加入远航") : "保存我的身份"); Spacer(); Image(systemName: "arrow.right") }
                    .font(.headline).padding(18).foregroundStyle(Color.expeditionNight).background(Color.expeditionGold, in: RoundedRectangle(cornerRadius: 15))
            }.buttonStyle(.plain).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || generating || loadingPhoto).opacity(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1).accessibilityIdentifier("crew-confirm")
        }
    }
    private func loadPhoto() async {
        guard let picker else { return }
        generation?.cancel(); generating = false; loadingPhoto = true; error = nil; avatar = nil
        let version = UUID(); selectionVersion = version
        defer { if selectionVersion == version { loadingPhoto = false } }
        do {
            guard let data = try await picker.loadTransferable(type: Data.self), let clean = CrewImage.jpeg(data) else { throw AvatarFailure.image }
            guard !Task.isCancelled, selectionVersion == version else { return }; photo = clean
        } catch { if !Task.isCancelled, selectionVersion == version { self.error = AvatarFailure.image.localizedDescription } }
    }
    private func generate() {
        guard let photo else { return }; generating = true; error = nil
        let version = selectionVersion
        generation = Task {
            do {
                let image = try await AvatarService.generate(photo)
                guard !Task.isCancelled, version == selectionVersion else { return }; avatar = image; generating = false
            } catch {
                guard !Task.isCancelled, version == selectionVersion else { return }; generating = false
                self.error = (error as? AvatarFailure)?.localizedDescription ?? AvatarFailure.unavailable.localizedDescription
            }
        }
    }
}
