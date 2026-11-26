import SwiftUI
import AVKit

private final class FilmSurface: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var videoLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

private struct FilmPicture: UIViewRepresentable {
    let player: AVPlayer?

    func makeUIView(context: Context) -> FilmSurface {
        let view = FilmSurface()
        view.backgroundColor = .black
        view.videoLayer.videoGravity = .resizeAspect
        return view
    }

    func updateUIView(_ view: FilmSurface, context: Context) {
        view.videoLayer.player = player
    }
}

struct TabletFilmView: View {
    let film: TabletFilm
    let captions: [FilmCaption]
    var onContinue: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("systemedu.ipad.chinese-film-captions") private var hasCaptions = true
    @State private var player: AVPlayer?
    @State private var observer: Any?
    @State private var seconds = 0.0
    @State private var duration = 0.0
    @State private var dragging = false
    @State private var playing = false
    @State private var controlsVisible = true
    @State private var transcript = false

    init(film: TabletFilm, onContinue: (() -> Void)? = nil) {
        self.onContinue = onContinue
        self.film = film
        self.captions = FilmCaption.load(film.captions)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            FilmPicture(player: player).ignoresSafeArea()
                .accessibilityElement().accessibilityLabel("简报画面").accessibilityIdentifier("ipad-film-player")
            Button { controlsVisible.toggle() } label: { Color.clear.contentShape(Rectangle()) }
                .buttonStyle(.plain).ignoresSafeArea()
                .accessibilityLabel(controlsVisible ? "隐藏播放控件" : "显示播放控件")

            if hasCaptions, let caption = captions.first(where: { seconds >= $0.start && seconds < $0.end }) {
                Text(caption.text).font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center).padding(.horizontal, 14).padding(.vertical, 8)
                    .background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 6))
                    .padding(.horizontal, 24).padding(.bottom, controlsVisible ? 95 : 28)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .allowsHitTesting(false).accessibilityIdentifier("ipad-film-caption")
            }
            if controlsVisible {
                VStack(spacing: 0) {
                    HStack(spacing: 16) {
                        Button { dismiss() } label: { Image(systemName: "xmark").frame(width: 44, height: 44) }
                            .accessibilityLabel("关闭简报").accessibilityIdentifier("ipad-close-film")
                        Text(film.title).font(.headline)
                        if let onContinue { Button("进入任务") { onContinue(); dismiss() }.font(.headline).accessibilityIdentifier("ipad-film-continue") }
                        Spacer()
                        if !captions.isEmpty {
                            Button { hasCaptions.toggle() } label: {
                                Label("字幕", systemImage: hasCaptions ? "captions.bubble.fill" : "captions.bubble")
                            }.frame(minHeight: 44).accessibilityIdentifier("ipad-film-subtitles")
                                .accessibilityValue(hasCaptions ? "开启" : "关闭")
                            Button { transcript = true } label: { Image(systemName: "text.alignleft").frame(width: 44, height: 44) }
                                .accessibilityLabel("查看完整字幕").accessibilityIdentifier("ipad-film-transcript")
                                .popover(isPresented: $transcript) { transcriptView }
                        }
                    }.padding(.horizontal, 16).padding(.vertical, 6).background(.black.opacity(0.72))
                    Spacer()
                    HStack(spacing: 16) {
                        Button { togglePlayback() } label: {
                            Image(systemName: playing ? "pause.fill" : "play.fill").font(.title3).frame(width: 44, height: 44)
                        }.accessibilityLabel(playing ? "暂停" : "播放").accessibilityIdentifier("ipad-film-play")
                        Text(time(seconds)).monospacedDigit().accessibilityLabel("已播放 \(Int(seconds)) 秒")
                            .accessibilityIdentifier("ipad-film-time")
                        Slider(value: $seconds, in: 0...max(duration, seconds, 1)) { editing in
                            dragging = editing
                            if !editing { seek(seconds) }
                        }.accessibilityLabel("播放进度").disabled(duration <= 0)
                        Text(time(duration)).monospacedDigit().accessibilityLabel("影片总时长")
                    }.font(.callout).padding(.horizontal, 24).padding(.vertical, 10).background(.black.opacity(0.72))
                }
            }
        }
        .foregroundStyle(.white).tint(.white).buttonStyle(.plain).preferredColorScheme(.dark)
        .statusBarHidden().persistentSystemOverlays(.hidden)
        .onAppear(perform: start)
        .onChange(of: scenePhase) { _, phase in if phase != .active { player?.pause(); playing = false } }
        .onDisappear {
            player?.pause()
            if let observer { player?.removeTimeObserver(observer) }
            observer = nil
            player = nil
        }
        .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification)) { notice in
            guard let item = notice.object as? AVPlayerItem, item === player?.currentItem else { return }
            playing = false
            controlsVisible = true
        }
    }

    private var transcriptView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("完整字幕").font(.headline)
                    Spacer()
                    Button("收起") { transcript = false }
                }
                ForEach(captions) { cue in
                    Button {
                        seek(cue.start)
                        transcript = false
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text(time(cue.start)).font(.caption.monospacedDigit())
                            Text(cue.text).multilineTextAlignment(.leading)
                        }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                }
            }.padding(20)
        }.frame(idealWidth: 390, idealHeight: 380).foregroundStyle(.primary)
    }

    private func start() {
        guard player == nil, let url = TabletMission.bundledURL(film.path) else { return }
        let video = AVPlayer(url: url)
        player = video
        observer = video.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.2, preferredTimescale: 600), queue: .main) { t in
            if !dragging, t.seconds.isFinite { seconds = max(0, t.seconds) }
            if let total = video.currentItem?.duration.seconds, total.isFinite { duration = total }
        }
        video.play()
        playing = true
    }

    private func seek(_ value: Double) {
        seconds = max(0, value)
        player?.seek(to: CMTime(seconds: seconds, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    private func togglePlayback() {
        if playing { player?.pause(); playing = false }
        else {
            if duration > 0 && seconds >= duration - 0.2 { seek(0) }
            player?.play()
            playing = true
        }
    }

    private func time(_ value: Double) -> String {
        let count = Int(max(value, 0))
        return String(format: "%d:%02d", count / 60, count % 60)
    }
}
