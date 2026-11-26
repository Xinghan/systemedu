import XCTest
import UIKit
@testable import SystemEdu

@MainActor
final class CrewCameraTests: XCTestCase {
    func testLegacyRoleWithoutArtworkResolvesBundledCharacter() throws {
        let legacy = Data(#"{"id":"engineer","title":"工程师","symbol":"wrench.and.screwdriver","duty":"动手验证"}"#.utf8)
        let role = try JSONDecoder().decode(ExpeditionRole.self, from: legacy)
        XCTAssertNil(role.artwork)
        XCTAssertNotNil(CrewArtwork.image(role))
        XCTAssertTrue(role.characterImagePath.hasSuffix("crew/engineer.png"))
        for role in try XCTUnwrap(Expedition.current).roles { XCTAssertNotNil(CrewArtwork.image(role)) }
    }
    func testCameraCancelProducesNoPhotoAndCaptureReturnsImage() throws {
        var result: CrewCameraResult?
        let coordinator = CrewCameraView.Coordinator { result = $0 }
        let picker = UIImagePickerController()
        coordinator.imagePickerControllerDidCancel(picker)
        guard case .cancelled = result else { return XCTFail("Cancel must not replace the selected image") }
        let source = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 64)).image { UIColor.blue.setFill(); $0.fill(CGRect(x: 0, y: 0, width: 32, height: 64)) }
        coordinator.imagePickerController(picker, didFinishPickingMediaWithInfo: [.originalImage: source])
        guard case .captured(let photo) = result else { return XCTFail("A capture must return the original UIImage") }
        let clean = try XCTUnwrap(CrewImage.jpeg(try XCTUnwrap(photo.jpegData(compressionQuality: 0.9))))
        let decoded = try XCTUnwrap(UIImage(data: clean)?.cgImage)
        XCTAssertEqual(decoded.width, source.cgImage?.width)
        XCTAssertEqual(decoded.height, source.cgImage?.height)
        coordinator.imagePickerController(picker, didFinishPickingMediaWithInfo: [:])
        guard case .unreadable = result else { return XCTFail("Missing photo must not be treated as a capture") }
    }
    func testCameraPurposeIsIncludedInBuiltApp() throws {
        let purpose = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String)
        XCTAssertTrue(purpose.contains("照片")); XCTAssertTrue(purpose.contains("不会自动上传"))
    }
}
