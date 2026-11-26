import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

enum CrewCameraIssue: String, Identifiable {
    case unavailable, denied, restricted
    var id: String { rawValue }
    var message: String {
        switch self {
        case .unavailable: return "当前设备没有可用摄像头，可以从相册选择照片，或直接使用卡通队员。"
        case .denied: return "相机权限尚未开启。你可以在系统设置中允许 SystemEdu 使用相机，也可以从相册选择照片。"
        case .restricted: return "此设备的相机访问受到限制。可以从相册选择照片，或直接使用卡通队员。"
        }
    }
}

enum CrewCameraResult { case captured(UIImage), cancelled, unreadable }

/// System still-photo camera. Images are returned in memory, never added to Photos.
struct CrewCameraView: UIViewControllerRepresentable {
    let onComplete: (CrewCameraResult) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let camera = UIImagePickerController()
        camera.sourceType = .camera
        camera.mediaTypes = [UTType.image.identifier]
        camera.cameraCaptureMode = .photo
        camera.allowsEditing = false
        if UIImagePickerController.isCameraDeviceAvailable(.front) { camera.cameraDevice = .front }
        camera.delegate = context.coordinator
        return camera
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onComplete: (CrewCameraResult) -> Void
        init(onComplete: @escaping (CrewCameraResult) -> Void) { self.onComplete = onComplete }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onComplete(.cancelled) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            guard let image = info[.originalImage] as? UIImage else { onComplete(.unreadable); return }
            onComplete(.captured(image))
        }
    }
}
