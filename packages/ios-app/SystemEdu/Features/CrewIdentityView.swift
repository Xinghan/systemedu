import SwiftUI
import PhotosUI
import ImageIO
import AVFoundation

private enum AvatarFailure: LocalizedError {
    case unavailable, failed, image
    var errorDescription: String? {
        switch self {
        case .unavailable: return "形象服务暂时不可用。可以重试，或先使用卡通队员加入；稍后仍可补上照片形象。"
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
                let role = profile?.role ?? Expedition.current?.roles.first
                ZStack(alignment: .top) {
                    (role?.crewAccent ?? .expeditionGold).opacity(0.2)
                    if let role, let image = CrewArtwork.image(role) {
                        Image(uiImage: image).resizable().scaledToFit()
                            .frame(width: size * 1.85, height: size * 1.85 * image.size.height / image.size.width)
                            .frame(width: size, height: size, alignment: .top)
                    }
                }
            }
        }.frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: size * 0.28))
            .overlay(RoundedRectangle(cornerRadius: size * 0.28).stroke(.white.opacity(0.25)))
            .accessibilityLabel(profile.map { "\($0.name)的卡通形象" } ?? "队员形象")
    }
}

enum CrewArtwork {
    private static let images: [String: UIImage] = Dictionary(uniqueKeysWithValues: (Expedition.current?.roles ?? []).compactMap { role in
        guard let url = TabletMission.bundledURL(role.characterImagePath), let image = UIImage(contentsOfFile: url.path) else { return nil }
        return (role.id, image)
    })
    static func image(_ role: ExpeditionRole) -> UIImage? { images[role.id] ?? images["observer"] }
}

extension ExpeditionRole {
    var crewAccent: Color {
        switch id {
        case "engineer": return Color(red: 0.41, green: 0.85, blue: 0.79)
        case "navigator": return Color(red: 0.73, green: 0.65, blue: 1)
        default: return .expeditionGold
        }
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
    @State private var showingCamera = false
    @State private var cameraIssue: CrewCameraIssue?
    @State private var requestingCamera = false
    @State private var cameraRequest: Task<Void, Never>?
    @FocusState private var editingName: Bool
    init(story: Expedition, existing: CrewProfile? = nil, onConfirm: @escaping (CrewProfile) -> Void) {
        self.story = story; self.existing = existing; self.onConfirm = onConfirm
        _name = State(initialValue: existing?.name ?? "")
        _roleID = State(initialValue: existing?.role.id ?? story.roles[0].id)
        _avatar = State(initialValue: existing?.avatar)
    }
    private var role: ExpeditionRole { story.roles.first { $0.id == roleID } ?? story.roles[0] }
    private var needsGeneration: Bool { photo != nil && avatar == nil }
    private var usesMacCamera: Bool {
        #if DEBUG && targetEnvironment(simulator)
        return !(ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_STORE"] != nil && ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_NATIVE_CAMERA"] == "1")
        #else
        return false
        #endif
    }
    var body: some View {
        ScrollView {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 34) { portrait.frame(width: 300); form.frame(width: 620) }
                VStack(spacing: 28) { portrait; form }
            }.padding(32).frame(maxWidth: .infinity)
        }.background(Color.expeditionNight).foregroundStyle(.white).tint(.expeditionGold)
            .task(id: picker) { await loadPhoto() }
            .fullScreenCover(isPresented: $showingCamera) {
                #if DEBUG && targetEnvironment(simulator)
                if usesMacCamera { MacCameraView(onComplete: finishCamera) }
                else { CrewCameraView(onComplete: finishCamera).ignoresSafeArea() }
                #else
                CrewCameraView(onComplete: finishCamera).ignoresSafeArea()
                #endif
            }
            .alert("拍摄队员照片", isPresented: Binding(get: { cameraIssue != nil }, set: { if !$0 { cameraIssue = nil } })) {
                if cameraIssue == .denied {
                    Button("前往设置") { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }
                }
                Button("知道了", role: .cancel) { cameraIssue = nil }
            } message: { Text(cameraIssue?.message ?? "") }
            .onDisappear {
                if !showingCamera { generation?.cancel(); cameraRequest?.cancel(); photo = nil }
            }
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
                } else if let image = CrewArtwork.image(role) {
                    LinearGradient(colors: [role.crewAccent.opacity(0.24), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(uiImage: image).resizable().scaledToFit().padding(.top, 12)
                }
                if generating { Color.black.opacity(0.55).clipShape(RoundedRectangle(cornerRadius: 28)); ProgressView("正在设计你的动画形象…").tint(.white) }
            }.frame(height: 350).clipShape(RoundedRectangle(cornerRadius: 28)).accessibilityIdentifier("crew-avatar-preview")
            if needsGeneration { Text("原照片 · 仅在本机预览").font(.caption).foregroundStyle(Color.expeditionGold) }
            Text(name.isEmpty ? "等待你的名字" : "\(name) · \(role.title)").font(.title2.bold())
            Text("你的名字和形象会出现在任务简报、课堂和每一份署名作品上。").font(.callout).foregroundStyle(.white.opacity(0.7)).lineSpacing(5)
        }
    }
    private var form: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 9) {
                Text("01  大家怎么称呼你").font(.headline)
                TextField("你的队员名", text: $name).textFieldStyle(.plain).padding(15).background(Color.expeditionPanel, in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("crew-name").focused($editingName).submitLabel(.done)
                    .onChange(of: name) { _, value in if value.count > 20 { name = String(value.prefix(20)) } }
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("02  选择你的队员身份").font(.headline)
                Text("我们是同一支队伍，一起完成这次远航。").font(.subheadline).foregroundStyle(.white.opacity(0.65))
                HStack(spacing: 10) {
                    ForEach(story.roles) { item in
                        Button { editingName = false; withAnimation(.easeInOut(duration: 0.18)) { roleID = item.id } } label: {
                            VStack(alignment: .leading, spacing: 0) {
                                ZStack(alignment: .topTrailing) {
                                    if let image = CrewArtwork.image(item) {
                                        Image(uiImage: image).resizable().scaledToFit().frame(maxWidth: .infinity).frame(height: 155).padding(.top, 8)
                                    }
                                    if roleID == item.id { Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(item.crewAccent).padding(10) }
                                }
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(item.title).font(.headline).foregroundStyle(item.crewAccent)
                                    Text(item.duty).font(.caption).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                                }.padding(13).frame(maxWidth: .infinity, alignment: .leading)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                                .background(LinearGradient(colors: [item.crewAccent.opacity(roleID == item.id ? 0.23 : 0.08), Color.expeditionPanel], startPoint: .top, endPoint: .bottom))
                                .clipShape(RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).stroke(roleID == item.id ? item.crewAccent : .white.opacity(0.1), lineWidth: roleID == item.id ? 2 : 1))
                        }.buttonStyle(.plain).accessibilityLabel("\(item.title)，\(item.duty)").accessibilityIdentifier("crew-role-" + item.id).accessibilityAddTraits(roleID == item.id ? .isSelected : [])
                    }
                }
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("03  照片变成动画形象 · 可选").font(.headline)
                HStack(spacing: 18) {
                    Button { editingName = false; cameraRequest = Task { await openCamera() } } label: { Label("拍一张", systemImage: "camera") }.accessibilityIdentifier("crew-take-photo")
                    PhotosPicker(selection: $picker, matching: .images) { Label("从相册选择", systemImage: "photo") }.accessibilityIdentifier("crew-choose-photo")
                }.buttonStyle(.bordered).disabled(generating || loadingPhoto || requestingCamera).frame(minHeight: 44)
                if photo != nil || avatar != nil {
                    HStack(spacing: 18) {
                        if photo != nil && avatar != nil {
                            Button("重新生成") { generate() }.disabled(generating || loadingPhoto).accessibilityIdentifier("crew-regenerate")
                        }
                        Button("使用卡通队员") { generation?.cancel(); selectionVersion = UUID(); generating = false; photo = nil; avatar = nil; picker = nil; error = nil }.font(.caption)
                    }.frame(minHeight: 44)
                }
                if loadingPhoto { ProgressView("正在读取照片…") }
                Text("拍摄或选择照片后先在本机预览。点击生成，照片才会发送至通义图像服务重绘，服务方按其规则处理。本机只保存你确认的动画形象，不保存原照片。").font(.caption).foregroundStyle(.white.opacity(0.62)).lineSpacing(4)
                if let error { Text(error).font(.callout).foregroundStyle(Color.expeditionGold).accessibilityIdentifier("crew-error") }
            }
            Button {
                if needsGeneration { generate() }
                else {
                    generation?.cancel(); photo = nil
                    onConfirm(CrewProfile(name: name.trimmingCharacters(in: .whitespacesAndNewlines), role: role, avatar: avatar))
                }
            } label: {
                HStack { Text(generating ? "正在生成你的动画形象…" : needsGeneration ? "将照片生成动画形象" : existing == nil ? "确认形象，加入远航" : "保存我的身份"); Spacer(); Image(systemName: "arrow.right") }
                    .font(.headline).padding(18).foregroundStyle(Color.expeditionNight).background(Color.expeditionGold, in: RoundedRectangle(cornerRadius: 15))
            }.buttonStyle(.plain).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || generating || loadingPhoto || requestingCamera).opacity(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1).accessibilityIdentifier(needsGeneration ? "crew-generate" : "crew-confirm")
        }
    }
    private func finishCamera(_ result: CrewCameraResult) {
        showingCamera = false
        switch result {
        case .cancelled: break
        case .unreadable: error = AvatarFailure.image.localizedDescription
        case .captured(let image):
            guard let bytes = image.jpegData(compressionQuality: 0.9), let clean = CrewImage.jpeg(bytes) else { error = AvatarFailure.image.localizedDescription; return }
            generation?.cancel(); selectionVersion = UUID(); generating = false
            picker = nil; photo = clean; avatar = nil; error = nil
        }
    }
    @MainActor private func openCamera() async {
        if usesMacCamera { showingCamera = true; return }
        guard !requestingCamera else { return }
        requestingCamera = true
        defer { requestingCamera = false }
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { cameraIssue = .unavailable; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: showingCamera = true
        case .notDetermined:
            let allowed = await AVCaptureDevice.requestAccess(for: .video)
            guard !Task.isCancelled else { return }
            if allowed { showingCamera = true } else { cameraIssue = .denied }
        case .denied: cameraIssue = .denied
        case .restricted: cameraIssue = .restricted
        @unknown default: cameraIssue = .unavailable
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
