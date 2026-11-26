import SwiftUI

#if DEBUG && targetEnvironment(simulator)
enum MacCameraFailure: LocalizedError {
    case service, expired, busy, message(String)
    var errorDescription: String? {
        switch self {
        case .service: return "Mac 相机连接服务未启动。请启动本机形象服务后重试，或关闭后从相册选择照片。"
        case .expired: return "Mac 相机连接已结束，请重新连接。"
        case .busy: return "另一处正在使用 Mac 相机，请先关闭那次连接。"
        case .message(let text): return text
        }
    }
}

struct MacCameraSession {
    let id = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    let reader = (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "").lowercased()
    let base: URL
    var url: URL { base.appendingPathComponent("camera/" + id) }
    static var endpoint: URL {
        if ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_STORE"] != nil,
           let value = ProcessInfo.processInfo.environment["SYSTEMEDU_TEST_CAMERA_ENDPOINT"],
           let url = URL(string: value), url.scheme == "http", url.host == "127.0.0.1", url.user == nil, url.password == nil { return url }
        return URL(string: "http://127.0.0.1:8769")!
    }
    func start() async throws {
        var request = URLRequest(url: base.appendingPathComponent("camera")); request.httpMethod = "POST"; request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("simulator", forHTTPHeaderField: "X-SystemEdu-Camera")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["id": id, "reader": reader])
        let (_, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 409 { throw MacCameraFailure.busy }
        guard (response as? HTTPURLResponse)?.statusCode == 202 else { throw MacCameraFailure.service }
    }
    struct Frame: Decodable { let status: String; let message: String; let image: String? }
    func next() async throws -> Frame {
        var request = URLRequest(url: url); request.timeoutInterval = 5; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue(reader, forHTTPHeaderField: "X-Camera-Token")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw MacCameraFailure.expired }
        let frame = try JSONDecoder().decode(Frame.self, from: data)
        if frame.status == "failed" { throw MacCameraFailure.message(frame.message) }
        return frame
    }
    func close() async {
        var request = URLRequest(url: url); request.httpMethod = "DELETE"; request.timeoutInterval = 3
        request.setValue(reader, forHTTPHeaderField: "X-Camera-Token")
        _ = try? await URLSession.shared.data(for: request)
    }
}

@MainActor final class MacCameraModel: ObservableObject {
    @Published var image: UIImage?
    @Published var message = "正在连接 Mac 摄像头…"
    @Published var failed = false
    private var session: MacCameraSession?
    private var lastFrame = Date.distantPast
    func connect() async {
        if let session { await session.close() }
        guard !Task.isCancelled else { return }
        image = nil; failed = false; message = "请在 Mac 打开的页面中点击「连接 Mac 摄像头」，并允许使用摄像头。"
        let current = MacCameraSession(base: MacCameraSession.endpoint); session = current
        defer { Task { await current.close() } }
        do {
            try await current.start()
            while !Task.isCancelled {
                let frame = try await current.next()
                try Task.checkCancellation()
                if let encoded = frame.image, let data = Data(base64Encoded: encoded), data.count <= 1_000_000, let picture = UIImage(data: data) {
                    image = picture; lastFrame = Date(); message = "调整位置，在模拟器里点击拍照。"
                } else { image = nil; message = frame.status == "live" ? "画面已暂停，请保持 Mac 相机页面打开，或重新连接。" : frame.message }
                try await Task.sleep(for: .milliseconds(300))
            }
        } catch {
            guard !Task.isCancelled else { return }
            image = nil; failed = true
            message = (error as? MacCameraFailure)?.localizedDescription ?? MacCameraFailure.service.localizedDescription
        }
    }
    func capturedImage() -> UIImage? { Date().timeIntervalSince(lastFrame) < 2 ? image : nil }
    func stop() { image = nil; if let session { Task { await session.close() } } }
}

struct MacCameraView: View {
    let onComplete: (CrewCameraResult) -> Void
    @StateObject private var camera = MacCameraModel()
    @State private var attempt = UUID()
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        VStack(spacing: 22) {
            HStack {
                Button("取消") { onComplete(.cancelled) }.accessibilityIdentifier("mac-camera-cancel")
                Spacer(); Text("Mac 摄像头 · 模拟器预览").font(.headline); Spacer()
            }
            ZStack {
                RoundedRectangle(cornerRadius: 24).fill(Color.expeditionPanel)
                if let image = camera.image {
                    Image(uiImage: image).resizable().scaledToFit().scaleEffect(x: -1, y: 1).accessibilityIdentifier("mac-camera-frame")
                } else {
                    VStack(spacing: 18) { if !camera.failed { ProgressView().tint(.white) }; Text(camera.message).multilineTextAlignment(.center).frame(maxWidth: 510) }.padding(32)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity).clipShape(RoundedRectangle(cornerRadius: 24))
            if camera.image != nil { Text(camera.message).foregroundStyle(.white.opacity(0.7)) }
            HStack(spacing: 24) {
                Button("重新连接") { attempt = UUID() }.accessibilityIdentifier("mac-camera-reconnect")
                Button { if let image = camera.capturedImage() { onComplete(.captured(image)) } } label: {
                    Label("拍照", systemImage: "camera.fill").font(.headline).padding(.horizontal, 28).padding(.vertical, 14)
                        .foregroundStyle(Color.expeditionNight).background(Color.expeditionGold, in: Capsule())
                }.disabled(camera.image == nil).opacity(camera.image == nil ? 0.4 : 1).accessibilityIdentifier("mac-camera-shutter")
            }
            Text("只在本机取景，不录音。拍完先预览，点击生成形象后才上传。").font(.caption).foregroundStyle(.white.opacity(0.6))
        }.padding(28).background(Color.expeditionNight).foregroundStyle(.white).tint(.expeditionGold)
            .task(id: attempt) { await camera.connect() }
            .onDisappear { camera.stop() }
            .onChange(of: scenePhase) { _, phase in if phase == .background { camera.stop() } }
    }
}
#endif
