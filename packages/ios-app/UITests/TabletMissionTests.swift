import XCTest
import UIKit

final class TabletMissionTests: XCTestCase {
    override func setUp() { super.setUp(); continueAfterFailure = false }
    @MainActor private func app(nativeCamera: Bool = false, cameraEndpoint: String? = nil) -> XCUIApplication {
        let app = XCUIApplication(); app.launchEnvironment["SYSTEMEDU_TEST_STORE"] = UUID().uuidString
        if nativeCamera { app.launchEnvironment["SYSTEMEDU_TEST_NATIVE_CAMERA"] = "1" }
        if let cameraEndpoint { app.launchEnvironment["SYSTEMEDU_TEST_CAMERA_ENDPOINT"] = cameraEndpoint }
        app.launch(); return app
    }
    @MainActor private func enter(_ app: XCUIApplication) {
        XCTAssertTrue(app.buttons["ipad-project-space"].waitForExistence(timeout: 20)); app.buttons["ipad-project-space"].tap()
    }
    @MainActor private func join(_ app: XCUIApplication) {
        let name = app.textFields["crew-name"]; XCTAssertTrue(name.waitForExistence(timeout: 10)); name.tap(); name.typeText("Starling")
        app.buttons["crew-role-engineer"].tap()
        let confirm = app.buttons["crew-confirm"]
        if !confirm.isHittable { app.swipeUp() }
        confirm.tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 10))
    }
    @MainActor private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor private func portraitApp(fullBody: Bool = true) throws -> XCUIApplication {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "crew-full-body", withExtension: "jpg", subdirectory: "Fixtures"))
        var data = try Data(contentsOf: url)
        if !fullBody {
            let image = try XCTUnwrap(UIImage(data: data)?.cgImage)
            let crop = try XCTUnwrap(image.cropping(to: CGRect(x: 0, y: 0, width: image.width, height: image.height / 2)))
            data = try XCTUnwrap(UIImage(cgImage: crop).jpegData(compressionQuality: 0.85))
        }
        let app = XCUIApplication()
        app.launchEnvironment["SYSTEMEDU_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["SYSTEMEDU_TEST_CREW_IMAGE"] = data.base64EncodedString()
        if fullBody { app.launchEnvironment["SYSTEMEDU_TEST_CREW_FRAMING"] = "full-body-v1" }
        app.launch(); enter(app); return app
    }
    @MainActor func testFullBodyProfileFitsBothOrientationsAndCancelKeepsIdentity() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = try portraitApp()
        app.buttons["crew-edit"].tap()
        let portrait = app.images["crew-profile-portrait"]
        XCTAssertTrue(portrait.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(portrait.label, "Portrait QA的全身卡通形象")
        for orientation: UIDeviceOrientation in [.landscapeLeft, .portrait] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(portrait.isHittable)
            XCTAssertTrue(app.windows.firstMatch.frame.contains(portrait.frame), "The full figure must fit within the screen")
            capture(orientation == .portrait ? "crew-full-body-profile-portrait" : "crew-full-body-profile-landscape")
        }
        let edit = app.buttons["crew-profile-edit"]
        if !edit.isHittable { app.swipeUp() }; edit.tap()
        let name = app.textFields["crew-name"]; XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap(); name.typeText(" Cancelled")
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertEqual(app.staticTexts["crew-profile-name"].label, "Portrait QA")
        app.buttons["完成"].tap()
        app.terminate(); app.launch(); enter(app); app.buttons["crew-edit"].tap()
        XCTAssertTrue(portrait.waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["crew-profile-name"].label, "Portrait QA")
    }
    @MainActor func testLegacyPortraitCanOpenUpgradeWithoutLosingExistingImage() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = try portraitApp(fullBody: false)
        app.buttons["crew-edit"].tap()
        XCTAssertTrue(app.images["crew-profile-portrait"].waitForExistence(timeout: 10))
        app.buttons["crew-profile-edit"].tap()
        let regenerate = app.buttons["crew-regenerate"]
        if !regenerate.isHittable { app.swipeUp() }
        XCTAssertTrue(regenerate.isEnabled); XCTAssertEqual(regenerate.label, "用当前形象生成全身立绘")
        capture("crew-existing-portrait-upgrade")
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertEqual(app.images["crew-profile-portrait"].label, "Portrait QA的卡通形象")
    }
    @MainActor func testSimplifiedClassroomOpensOriginalDownloadsAndFilesPicker() {
        verifyClassroomMaterials(exportZIP: true)
    }
    @MainActor func testNotebookAndCSVRenderReadableNativeText() {
        verifyClassroomMaterials(exportZIP: false)
    }
    @MainActor private func verifyClassroomMaterials(exportZIP: Bool) {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SYSTEMEDU_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["SYSTEMEDU_TEST_EXPEDITION"] = "stale-cursor"
        app.launch(); enter(app); app.buttons["expedition-continue"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["动画与互动"].waitForExistence(timeout: 20))
        XCTAssertFalse(web.buttons["讲课"].exists)
        XCTAssertFalse(web.buttons["导出记录"].exists)
        capture("ipad-simplified-classroom")
        web.buttons["动画与互动"].tap()
        let names = ["junior-guide.ipynb", "kepler10-q3-validity-input.csv"] + (exportZIP ? ["lightkurve-practice-kit.zip"] : [])
        for name in names {
            let link = web.links.matching(NSPredicate(format: "label == %@", name + " ↗")).firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 10), app.debugDescription)
            if !link.isHittable { web.swipeUp() }
            link.tap()
            let save = app.buttons["classroom-file-save"]
            XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription)
            XCTAssertTrue(app.navigationBars[name].exists)
            if !name.hasSuffix("zip") {
                let content = app.textViews["classroom-file-content"]
                XCTAssertTrue(content.waitForExistence(timeout: 5), app.debugDescription)
                XCTAssertTrue(content.isHittable)
                XCTAssertTrue((content.value as? String)?.contains(name.hasSuffix("ipynb") ? "Kepler-10" : "TIME_BKJD") == true)
                XCTAssertGreaterThan(content.frame.height, 300)
            }
            capture("ipad-material-" + name)
            if name.hasSuffix("zip") {
                save.tap()
                let confirm = app.buttons.matching(NSPredicate(format: "label IN %@", ["Export", "Save", "Move", "存储", "保存", "导出"])).firstMatch
                XCTAssertTrue(confirm.waitForExistence(timeout: 10), app.debugDescription)
                XCTAssertTrue(confirm.isEnabled, app.debugDescription)
                // Repeated tests must not replace a student's existing download.
                let filename = app.textFields.matching(NSPredicate(format: "value == %@", "lightkurve-practice-kit")).firstMatch
                XCTAssertTrue(filename.waitForExistence(timeout: 5), app.debugDescription)
                filename.tap(); filename.typeText("-qa-" + UUID().uuidString.prefix(8))
                capture("ipad-save-material-to-files")
                confirm.tap()
                XCTAssertTrue(save.waitForExistence(timeout: 10))
                XCTAssertTrue(save.isHittable, app.debugDescription)
            }
            app.buttons["classroom-file-close"].tap()
            XCTAssertTrue(web.buttons["关闭面板"].waitForExistence(timeout: 10))
        }
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(web.buttons["练习与笔记"].exists)
    }
    @MainActor func testSingleRouteIdentityAndReturnToHome() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app()
        XCTAssertTrue(app.staticTexts["ipad-home-title"].waitForExistence(timeout: 15))
        app.buttons["ipad-home-library"].tap(); XCTAssertFalse(app.buttons["ipad-browse-catalog"].exists)
        enter(app); capture("expedition-crew-onboarding"); join(app)
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "留下第一张星球照片")
        XCTAssertFalse(app.segmentedControls["ipad-journey-track"].exists)
        XCTAssertFalse(app.buttons["选择探索方向"].exists)
        XCTAssertEqual(app.buttons.matching(identifier: "expedition-continue").count, 1)
        XCTAssertFalse(app.buttons["expedition-stop-research-P1"].exists)
        capture("expedition-single-route-home")
        app.buttons["ipad-exit-project"].tap(); enter(app)
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 10)); XCTAssertFalse(app.textFields["crew-name"].exists)
        app.terminate(); app.launch(); enter(app)
        XCTAssertTrue(app.buttons["crew-edit"].waitForExistence(timeout: 10)); XCTAssertTrue(app.buttons["crew-edit"].label.contains("Starling"))
    }
    @MainActor func testAnimeBriefingControlsAndClassroomRestore() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-play"].waitForExistence(timeout: 10))
        let timer = app.staticTexts["ipad-film-time"]
        expectation(for: NSPredicate(format: "label MATCHES %@", "已播放 [1-9][0-9]* 秒"), evaluatedWith: timer)
        waitForExpectations(timeout: 15)
        app.buttons["ipad-film-play"].tap()
        let subtitle = app.buttons["ipad-film-subtitles"]; let before = subtitle.value as? String; subtitle.tap(); XCTAssertNotEqual(before, subtitle.value as? String)
        app.buttons["ipad-film-transcript"].tap(); XCTAssertTrue(app.staticTexts["完整字幕"].waitForExistence(timeout: 5)); app.buttons["收起"].tap(); capture("expedition-anime-briefing")
        app.buttons["ipad-film-continue"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
        web.buttons["练习与笔记"].tap()
        let note = web.textViews.firstMatch; XCTAssertTrue(note.waitForExistence(timeout: 8)); note.tap(); note.typeText("Saved expedition observation")
        web.buttons["关闭面板"].tap(); XCTAssertFalse(web.staticTexts["已保存到本机"].exists)
        capture("expedition-original-classroom")
        app.terminate(); app.launch(); enter(app); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20)); web.buttons["练习与笔记"].tap()
        XCTAssertTrue(note.waitForExistence(timeout: 8)); XCTAssertTrue((note.value as? String)?.contains("Saved expedition observation") == true)
    }
    @MainActor func testPortraitOnboardingAndEmptyArchive() {
        XCUIDevice.shared.orientation = .portrait
        let app = app(); enter(app); capture("crew-character-portrait"); join(app); capture("expedition-portrait-home")
        XCTAssertTrue(app.buttons["expedition-continue"].isHittable)
        app.buttons["expedition-archive"].tap()
        XCTAssertTrue(app.staticTexts["第一份作品正在等你"].waitForExistence(timeout: 10)); app.buttons["完成"].tap()
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 8))
    }

    @MainActor func testCharacterSelectionAndCameraCancellationKeepIdentity() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(nativeCamera: true); app.terminate(); app.resetAuthorizationStatus(for: .camera); app.launch(); enter(app)
        let name = app.textFields["crew-name"]; XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap(); name.typeText("Nova")
        for role in ["engineer", "navigator", "observer"] {
            app.buttons["crew-role-" + role].tap()
            XCTAssertTrue(app.buttons["crew-role-" + role].isSelected)
        }
        capture("crew-character-landscape")
        let camera = app.buttons["crew-take-photo"]
        if !camera.isHittable { app.swipeUp() }
        camera.tap()
        let permission = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts["Allow “SystemEdu” to access your camera?"]
        if permission.waitForExistence(timeout: 3) { permission.buttons["Allow"].tap() }
        let alert = app.alerts["拍摄队员照片"]
        if alert.waitForExistence(timeout: 2) {
            XCTAssertTrue(alert.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "没有可用摄像头")).firstMatch.exists)
            capture("crew-camera-unavailable"); alert.buttons["知道了"].tap()
        } else {
            let cancel = app.buttons.matching(NSPredicate(format: "identifier == %@ OR label IN %@", "DismissButton", ["Cancel", "取消"])).firstMatch
            XCTAssertTrue(cancel.waitForExistence(timeout: 10), app.debugDescription)
            capture("crew-system-camera"); cancel.tap()
        }
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        XCTAssertEqual(name.value as? String, "Nova")
        XCTAssertTrue(app.buttons["crew-role-observer"].isSelected)
        XCTAssertTrue(app.buttons["crew-choose-photo"].isEnabled)
    }

    @MainActor func testCameraPermissionDenialKeepsPhotoOptions() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(nativeCamera: true); app.terminate(); app.resetAuthorizationStatus(for: .camera); app.launch(); enter(app)
        let camera = app.buttons["crew-take-photo"]; XCTAssertTrue(camera.waitForExistence(timeout: 10)); camera.tap()
        let permission = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts["Allow “SystemEdu” to access your camera?"]
        if permission.waitForExistence(timeout: 3) {
            XCTAssertEqual(permission.buttons.count, 2)
            permission.buttons.matching(NSPredicate(format: "label != %@", "Allow")).firstMatch.tap()
            let alert = app.alerts["拍摄队员照片"]
            XCTAssertTrue(alert.waitForExistence(timeout: 5))
            XCTAssertTrue(alert.buttons["前往设置"].exists)
            capture("crew-camera-denied"); alert.buttons["知道了"].tap()
            XCTAssertTrue(app.buttons["crew-choose-photo"].isEnabled)
        } else {
            XCTAssertTrue(app.alerts["拍摄队员照片"].waitForExistence(timeout: 3))
            app.alerts["拍摄队员照片"].buttons["知道了"].tap()
        }
    }

    @MainActor func testPhotoLibraryOpensAndCancelKeepsCharacter() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app)
        let photos = app.buttons["crew-choose-photo"]; XCTAssertTrue(photos.waitForExistence(timeout: 10)); photos.tap()
        let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "取消"])).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 10), app.debugDescription)
        capture("crew-system-photo-library"); cancel.tap()
        XCTAssertTrue(app.buttons["crew-role-observer"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["crew-role-observer"].isSelected)
        XCTAssertFalse(app.buttons["crew-generate"].exists)
        join(app); capture("crew-avatar-task-home")
    }
    // Import the documented synthetic fixture with simctl addmedia before this integration test.
    @MainActor func testImportedSimulatorPhotoCanBeSelected() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app)
        app.buttons["crew-choose-photo"].tap()
        let cell = app.images.matching(identifier: "PXGGridLayout-Info").firstMatch
        XCTAssertTrue(cell.waitForExistence(timeout: 45), app.debugDescription)
        capture("crew-imported-photo-library"); cell.tap()
        XCTAssertTrue(app.buttons["crew-generate"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["原照片 · 仅在本机预览"].exists)
        capture("crew-imported-photo-preview")
    }

    // Run the synthetic fixture service on 8879; this never requests the Mac hardware camera.
    @MainActor func testMacCameraCaptureAndCancel() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(cameraEndpoint: "http://127.0.0.1:8879"); enter(app)
        let name = app.textFields["crew-name"]; name.tap(); name.typeText("Nova")
        app.buttons["crew-role-engineer"].tap(); app.buttons["crew-take-photo"].tap()
        XCTAssertTrue(app.images["mac-camera-frame"].waitForExistence(timeout: 15), app.debugDescription)
        capture("crew-mac-camera-synthetic-preview")
        app.buttons["mac-camera-shutter"].tap()
        XCTAssertTrue(app.buttons["crew-generate"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["原照片 · 仅在本机预览"].exists)
        capture("crew-mac-camera-captured-preview")
        app.buttons["crew-take-photo"].tap()
        XCTAssertTrue(app.images["mac-camera-frame"].waitForExistence(timeout: 15))
        app.buttons["mac-camera-cancel"].tap()
        XCTAssertEqual(name.value as? String, "Nova")
        XCTAssertTrue(app.buttons["crew-role-engineer"].isSelected)
        XCTAssertTrue(app.buttons["crew-generate"].exists)
    }

    @MainActor func testMacCameraUnavailableAllowsReturnToPhotos() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(cameraEndpoint: "http://127.0.0.1:1"); enter(app)
        app.buttons["crew-take-photo"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Mac 相机连接服务未启动")).firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["mac-camera-shutter"].isEnabled)
        app.buttons["mac-camera-cancel"].tap()
        XCTAssertTrue(app.buttons["crew-choose-photo"].isEnabled)
    }

    @MainActor func testCapturedWorkIsArchivedAndUnlocksOnlyTheNextChapter() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["动画与互动"].waitForExistence(timeout: 20)); web.buttons["动画与互动"].tap()
        let lab = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "进入实验：")).firstMatch
        XCTAssertTrue(lab.waitForExistence(timeout: 10)); lab.tap()
        let left = web.buttons["镜头向左"]
        XCTAssertTrue(left.waitForExistence(timeout: 20))
        for _ in 0..<5 { left.tap() }
        for _ in 0..<2 { web.buttons["镜头向上"].tap() }
        web.buttons["放大"].tap()
        let shutter = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "拍下这张照片")).firstMatch
        XCTAssertTrue(shutter.isEnabled); shutter.tap()
        XCTAssertTrue(web.buttons["关闭照片"].waitForExistence(timeout: 10)); capture("expedition-student-capture")
        web.buttons["关闭照片"].tap(); web.buttons["关闭面板"].tap()
        XCTAssertFalse(web.staticTexts["已保存到本机"].exists)
        let next = app.buttons["expedition-next-step"]; XCTAssertTrue(next.isEnabled); next.tap()
        XCTAssertTrue(app.staticTexts["expedition-delivery-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.images["expedition-work-image"].exists)
        XCTAssertFalse(app.buttons["expedition-submit"].isEnabled)
        let check = app.buttons["evidence-check-0"]
        if !check.isHittable { app.swipeUp() }
        check.tap()
        let submit = app.buttons["expedition-submit"]
        if !submit.isHittable { app.swipeUp() }
        XCTAssertTrue(submit.isEnabled); capture("expedition-work-self-check"); submit.tap()
        XCTAssertTrue(app.buttons["ipad-close-film"].waitForExistence(timeout: 15))
        capture("first-chapter-completion-auto-playing")
        app.buttons["ipad-close-film"].tap()
        let advance = app.buttons["expedition-next-chapter"]
        XCTAssertTrue(advance.waitForExistence(timeout: 10)); capture("expedition-signed-delivery")
        if !advance.isHittable { app.swipeUp() }; advance.tap()
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "星光为什么变暗了")
        capture("expedition-chapter-two-handoff")
        app.terminate(); app.launch(); enter(app)
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "星光为什么变暗了")
        app.buttons["expedition-archive"].tap(); XCTAssertTrue(app.staticTexts["第一份星球观测"].waitForExistence(timeout: 10))
        app.buttons["完成"].tap(); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        XCTAssertTrue(web.buttons["下一页"].waitForExistence(timeout: 20))
        let first = web.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "本节阅读 1 /")).firstMatch
        let second = web.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "本节阅读 2 /")).firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        // Touch the reading surface, not its controls: real WKWebView gesture delivery.
        func swipe(_ left: Bool) {
            web.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.72 : 0.28, dy: 0.16))
                .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.28 : 0.72, dy: 0.16)))
        }
        swipe(true); XCTAssertTrue(second.waitForExistence(timeout: 5)); capture("ipad-reader-chapter-two-landscape")
        XCTAssertTrue(web.staticTexts["先认识这次远航要研究的东西"].exists)
        XCTAssertTrue(app.buttons["ipad-lesson-back"].isHittable)
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
        // An upward reading gesture scrolls within the current section.
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.65))
            .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.4)))
        XCTAssertTrue(web.buttons["上一页"].isEnabled)
        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 10))
        web.buttons["上一页"].tap(); XCTAssertTrue(first.waitForExistence(timeout: 5))
        swipe(true); XCTAssertTrue(second.waitForExistence(timeout: 5)); capture("ipad-reader-chapter-two-portrait")
        web.buttons["练习与笔记"].tap()
        let note = web.textViews.firstMatch; XCTAssertTrue(note.waitForExistence(timeout: 8)); note.tap(); note.typeText("The shadow depends on our viewing direction.")
        web.buttons["关闭面板"].tap(); XCTAssertFalse(web.staticTexts["已保存到本机"].exists)
        app.terminate(); app.launch(); enter(app); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(second.waitForExistence(timeout: 20))
        web.buttons["练习与笔记"].tap(); XCTAssertTrue(note.waitForExistence(timeout: 8)); XCTAssertTrue((note.value as? String)?.contains("viewing direction") == true)
        web.buttons["关闭面板"].tap(); swipe(false); XCTAssertTrue(first.waitForExistence(timeout: 5))
    }

    @MainActor func testInlineMissionEntryOpensTelescope() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        let web = app.webViews.firstMatch
        let entry = web.buttons["进入实验：我的第一张星球照片"]
        XCTAssertTrue(entry.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(web.staticTexts["Starling，这是你的任务"].exists)
        if !entry.isHittable { web.swipeUp() }
        entry.tap()
        XCTAssertTrue(web.buttons["镜头向左"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(web.staticTexts["Starling的操作席"].exists)
        XCTAssertTrue(web.staticTexts["Starling的观测席"].exists)
        capture("expedition-inline-telescope-open")
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
    }

    @MainActor func testObservatoryFitsLandscapeAndPortraitWithoutScrolling() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        let web = app.webViews.firstMatch
        let entry = web.buttons["进入实验：我的第一张星球照片"]
        XCTAssertTrue(entry.waitForExistence(timeout: 20)); entry.tap()
        let left = web.buttons["镜头向左"]
        XCTAssertTrue(left.waitForExistence(timeout: 20))
        for orientation in [UIDeviceOrientation.landscapeLeft, .portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(left.waitForExistence(timeout: 10))
            XCTAssertFalse(app.buttons["expedition-next-step"].exists)
            XCTAssertFalse(app.buttons["ipad-lesson-back"].exists)
            for name in ["镜头向左", "镜头向右", "镜头向上", "镜头向下", "放大", "缩小"] {
                let button = web.buttons[name]
                XCTAssertTrue(button.isHittable, name + " should need no scrolling")
                XCTAssertGreaterThanOrEqual(button.frame.width, 44)
                XCTAssertGreaterThanOrEqual(button.frame.height, 44)
            }
            let shutter = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "拍下这张照片")).firstMatch
            XCTAssertTrue(shutter.exists)
            XCTAssertLessThanOrEqual(shutter.frame.maxY, web.frame.maxY)
            XCTAssertGreaterThanOrEqual(shutter.frame.minY, web.frame.minY)
            capture(orientation == .portrait ? "observatory-fitted-portrait" : "observatory-fitted-landscape")
        }
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(app.buttons["ipad-lesson-back"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["expedition-next-step"].exists)
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
    }

    @MainActor func testFilmCanExitWithHiddenControlsAndDoesNotBlockReentry() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        let timer = app.staticTexts["ipad-film-time"]
        expectation(for: NSPredicate(format: "label MATCHES %@", "已播放 [1-9][0-9]* 秒"), evaluatedWith: timer)
        waitForExpectations(timeout: 15)
        app.buttons["ipad-film-surface"].tap()
        XCTAssertTrue(app.buttons["ipad-close-film"].isHittable)
        XCTAssertTrue(app.buttons["ipad-film-continue"].isHittable)
        capture("film-persistent-exit-and-skip")
        app.buttons["ipad-close-film"].tap()
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 10))
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.webViews.firstMatch.buttons["练习与笔记"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["ipad-film-player"].exists)
    }

    @MainActor func testFilmEndKeepsAVisibleRouteIntoTheLesson() {
        XCUIDevice.shared.orientation = .portrait
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        let progress = app.sliders["播放进度"]
        XCTAssertTrue(progress.waitForExistence(timeout: 10))
        expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: progress)
        waitForExpectations(timeout: 10)
        progress.adjust(toNormalizedSliderPosition: 1)
        let next = app.buttons["ipad-film-continue"]
        expectation(for: NSPredicate(format: "label == %@", "进入任务"), evaluatedWith: next)
        waitForExpectations(timeout: 10)
        XCTAssertTrue(next.isHittable); capture("film-finished-portrait")
        next.tap()
        XCTAssertTrue(app.webViews.firstMatch.buttons["练习与笔记"].waitForExistence(timeout: 20))
    }

    @MainActor func testReadingAloneReturnsToObservationInsteadOfEmptyDelivery() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["下一页"].waitForExistence(timeout: 20)); web.buttons["下一页"].tap()
        let read = web.buttons["完成本节，整理本章作品"]
        XCTAssertTrue(read.waitForExistence(timeout: 10))
        if !read.isHittable { web.swipeUp() }
        read.tap()
        XCTAssertTrue(web.staticTexts["请先在望远镜里调整镜头并拍下一张照片，再整理本章作品。"].waitForExistence(timeout: 10))
        XCTAssertFalse(web.staticTexts["已保存到本机"].exists)
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
        app.buttons["ipad-lesson-back"].tap()
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 10)); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["expedition-delivery-title"].exists)
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
    }

    @MainActor private func navigationApp(_ scenario: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["SYSTEMEDU_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["SYSTEMEDU_TEST_EXPEDITION"] = scenario
        app.launch(); return app
    }
    @MainActor func testProjectFilmReplayAndPersistentReviewNavigation() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = navigationApp("stale-cursor"); enter(app)
        app.buttons["expedition-project-film"].tap()
        XCTAssertTrue(app.buttons["ipad-close-film"].waitForExistence(timeout: 10))
        capture("project-introduction-replay")
        app.buttons["ipad-close-film"].tap()
        app.buttons["expedition-continue"].tap()
        let heading = app.staticTexts["expedition-lesson-title"]
        XCTAssertTrue(heading.waitForExistence(timeout: 20))
        XCTAssertEqual(heading.label, "了解 Kepler-10 的观测数据")
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["动画与互动"].waitForExistence(timeout: 20))
        web.buttons["动画与互动"].tap()
        XCTAssertTrue(app.buttons["ipad-lesson-back"].isHittable, "Immersive presentation must retain a native escape")
        XCTAssertTrue(app.buttons["expedition-lesson-map"].isHittable)
        capture("persistent-navigation-over-immersive-classroom")
        web.buttons["关闭面板"].tap()
        app.buttons["expedition-previous-lesson"].tap()
        expectation(for: NSPredicate(format: "label != %@", "了解 Kepler-10 的观测数据"), evaluatedWith: heading)
        waitForExpectations(timeout: 10)
        XCTAssertTrue(app.staticTexts["expedition-lesson-position"].label.contains("本章第 1 / 5 节"))
        app.buttons["expedition-lesson-map"].tap()
        let locked = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND enabled == false", "expedition-route-")).firstMatch
        XCTAssertTrue(locked.waitForExistence(timeout: 10), app.debugDescription)
        capture("review-map-keeps-future-nodes-locked")
        app.buttons["expedition-route-lightkurve-transit-detective:M02"].tap()
        expectation(for: NSPredicate(format: "label == %@", "了解 Kepler-10 的观测数据"), evaluatedWith: heading)
        waitForExpectations(timeout: 15)
        app.buttons["expedition-previous-lesson"].tap()
        app.buttons["ipad-lesson-back"].tap()
        app.buttons["expedition-continue"].tap()
        expectation(for: NSPredicate(format: "label == %@", "了解 Kepler-10 的观测数据"), evaluatedWith: heading)
        waitForExpectations(timeout: 15)
        XCUIDevice.shared.orientation = .portrait
        expectation(for: NSPredicate { _, _ in app.windows.firstMatch.frame.height > app.windows.firstMatch.frame.width && web.buttons["练习与笔记"].isHittable }, evaluatedWith: app)
        waitForExpectations(timeout: 15)
        Thread.sleep(forTimeInterval: 1) // Wait for the rotation compositor before taking a screenshot.
        XCTAssertTrue(app.buttons["ipad-lesson-back"].isHittable)
        XCTAssertTrue(app.buttons["expedition-lesson-map"].isHittable)
        capture("persistent-navigation-portrait")
        app.buttons["ipad-lesson-back"].tap()
        app.buttons["expedition-route-map"].tap()
        app.buttons["expedition-close-map"].tap()
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "星光为什么变暗了")
    }
    @MainActor func testMapEntryPlaysFirstBriefingAndLessonCanReplayFilms() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        app.buttons["expedition-route-map"].tap()
        let node = app.buttons["expedition-route-spot-a-world:M01"]
        XCTAssertTrue(node.waitForExistence(timeout: 10)); node.tap()
        XCTAssertTrue(app.buttons["ipad-close-film"].waitForExistence(timeout: 10), "Map entry must keep the first chapter briefing")
        app.buttons["ipad-close-film"].tap()
        app.buttons["expedition-continue"].tap()
        let heading = app.staticTexts["expedition-lesson-title"]
        XCTAssertTrue(heading.waitForExistence(timeout: 15))
        let original = heading.label
        for title in ["项目介绍", "本章开场"] {
            app.buttons["expedition-lesson-films"].tap()
            app.buttons[title].tap()
            XCTAssertTrue(app.buttons["ipad-close-film"].waitForExistence(timeout: 10))
            app.buttons["ipad-close-film"].tap()
            XCTAssertTrue(heading.waitForExistence(timeout: 10)); XCTAssertEqual(heading.label, original)
        }
        capture("lesson-contextual-film-replay")
    }
    @MainActor private func finishCurrentLesson(_ app: XCUIApplication, finalStep: Bool, nextTitle: String? = nil) {
        let web = app.webViews.firstMatch
        let contents = web.buttons["打开课文目录"]
        XCTAssertTrue(contents.waitForExistence(timeout: 20))
        // WKWebView accessibility can report controls before its first layout settles.
        let visible = NSPredicate { _, _ in contents.isHittable && web.buttons["练习与笔记"].isHittable }
        expectation(for: visible, evaluatedWith: contents); waitForExpectations(timeout: 10)
        contents.tap()
        // The final section contains the completion action in every original lesson.
        let sections = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "阅读部分 "))
        guard sections.firstMatch.waitForExistence(timeout: 10) else {
            capture("completion-directory-did-not-open")
            XCTFail("阅读目录未展开：" + web.debugDescription); return
        }
        XCTAssertGreaterThan(sections.count, 0, web.debugDescription)
        let last = sections.element(boundBy: sections.count - 1)
        for _ in 0..<12 { if last.isHittable { break }; web.swipeUp() }
        XCTAssertTrue(last.isHittable, web.debugDescription); last.tap()
        let finish = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", finalStep ? "完成本节，整理本章作品" : "完成本节，进入「")).firstMatch
        XCTAssertTrue(finish.waitForExistence(timeout: 10))
        if finalStep { XCTAssertEqual(finish.label, "完成本节，整理本章作品") }
        else { XCTAssertTrue(finish.label.hasPrefix("完成本节，进入「")) }
        if let nextTitle { XCTAssertEqual(finish.label, "完成本节，进入「\(nextTitle)」") }
        for _ in 0..<12 { if finish.isHittable { break }; web.swipeUp() }
        XCTAssertTrue(finish.isHittable, web.debugDescription); finish.tap()
    }
    @MainActor func testEveryResearchLessonShowsItsOwnIdentityAndExplicitHandoff() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = navigationApp("stale-cursor"); enter(app)
        app.buttons["expedition-continue"].tap()
        let titles = ["了解 Kepler-10 的观测数据", "读懂光变曲线的时间轴与亮度轴", "选择一段可能包含亮度下降的观测", "整理第一份观测记录"]
        for (offset, title) in titles.enumerated() {
            let heading = app.staticTexts["expedition-lesson-title"]
            expectation(for: NSPredicate(format: "label == %@", title), evaluatedWith: heading)
            waitForExpectations(timeout: 20)
            XCTAssertTrue(app.webViews.firstMatch.staticTexts[title].waitForExistence(timeout: 20))
            XCTAssertTrue(app.staticTexts["expedition-lesson-position"].label.contains("本章第 \(offset + 2) / 5 节"))
            XCTAssertTrue(app.webViews.firstMatch.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "本节阅读 1 /")).firstMatch.exists)
            if offset > 0 {
                let transition = app.descendants(matching: .any).matching(identifier: "expedition-lesson-transition").firstMatch
                XCTAssertTrue(transition.exists)
                XCTAssertTrue(transition.label.contains("已完成「\(titles[offset - 1])」"))
                XCTAssertTrue(transition.label.contains("已进入本章第 \(offset + 2) 节"))
            }
            capture("distinct-lesson-M0\(offset + 2)")
            if offset == 2 {
                app.terminate(); app.launch(); enter(app); app.buttons["expedition-continue"].tap()
                expectation(for: NSPredicate(format: "label == %@", title), evaluatedWith: heading)
                waitForExpectations(timeout: 20)
            }
            finishCurrentLesson(app, finalStep: offset == titles.count - 1, nextTitle: offset + 1 < titles.count ? titles[offset + 1] : nil)
        }
        XCTAssertTrue(app.staticTexts["expedition-delivery-title"].waitForExistence(timeout: 15))
        capture("research-chapter-delivery-after-fifth-lesson")
    }
    @MainActor func testCompletedLessonResumesForwardAndFinishesWithoutReturningToOldLesson() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = navigationApp("stale-cursor"); enter(app)
        app.buttons["expedition-continue"].tap()
        let second = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "本章第 2 / 5 节")).firstMatch
        XCTAssertTrue(second.waitForExistence(timeout: 20), app.debugDescription)
        finishCurrentLesson(app, finalStep: false)
        let third = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "本章第 3 / 5 节")).firstMatch
        XCTAssertTrue(third.waitForExistence(timeout: 15), app.debugDescription)
        capture("completion-forward-to-third-lesson")
        app.buttons["ipad-lesson-back"].tap(); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(third.waitForExistence(timeout: 15))
        app.terminate(); app.launch(); enter(app); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(third.waitForExistence(timeout: 20))
    }
    @MainActor func testEveryRemainingChapterFinishesAndOpensOnlyItsSuccessor() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = navigationApp("chapter-endings"); enter(app)
        let chapters = ["星光为什么变暗了", "整理来自望远镜的数据", "寻找重复出现的节奏", "调查其他可能的解释", "让新数据检验预测", "把研究交给下一位队员", "为近距离探测制定计划", "让设计站得稳", "造出第一辆原型车", "让车看懂脚下的地面", "把判断接到行动上", "完成一次有记录的远征", "把你的发现交给下一班"]
        for (index, title) in chapters.enumerated() {
            let heading = app.staticTexts["expedition-chapter-title"]
            XCTAssertTrue(heading.waitForExistence(timeout: 15)); XCTAssertEqual(heading.label, title)
            app.buttons["expedition-continue"].tap()
            finishCurrentLesson(app, finalStep: true)
            XCTAssertTrue(app.staticTexts["expedition-delivery-title"].waitForExistence(timeout: 15), title)
            let checks = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "evidence-check-"))
            for i in 0..<checks.count {
                let check = app.buttons["evidence-check-\(i)"]
                for _ in 0..<12 { if check.isHittable { break }; app.swipeUp() }
                XCTAssertTrue(check.isHittable, title); check.tap()
            }
            let submit = app.buttons["expedition-submit"]
            for _ in 0..<12 { if submit.isHittable { break }; app.swipeUp() }
            XCTAssertTrue(submit.isEnabled, title); submit.tap()
            XCTAssertTrue(app.buttons["ipad-close-film"].waitForExistence(timeout: 15), title + " must automatically present its own closing")
            if index + 1 < chapters.count { XCTAssertTrue(app.buttons["ipad-film-continue"].label.contains(chapters[index + 1])) }
            else { XCTAssertTrue(app.buttons["ipad-film-continue"].label.contains("完成远航")) }
            if [0, 5, 12].contains(index) { capture("chapter-\(index + 2)-closing-video") }
            app.buttons["ipad-close-film"].tap()
            let next = app.buttons["expedition-next-chapter"]
            XCTAssertTrue(next.waitForExistence(timeout: 15), title)
            for _ in 0..<12 { if next.isHittable { break }; app.swipeUp() }
            if [0, 5, 12].contains(index) { capture("chapter-\(index + 2)-handoff") }
            next.tap()
        }
        let finished = app.staticTexts["Navigation QA，远航档案已交接。"]
        XCTAssertTrue(finished.waitForExistence(timeout: 15)); capture("all-chapters-finished")
        app.terminate(); app.launch(); enter(app)
        XCTAssertTrue(finished.waitForExistence(timeout: 15))
    }

    @MainActor func testCompletionFilmAutomaticallyPlaysClosesReplaysAndAdvancesOnce() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = navigationApp("chapter-endings"); enter(app)
        app.buttons["expedition-continue"].tap()
        finishCurrentLesson(app, finalStep: true)
        XCTAssertTrue(app.staticTexts["expedition-delivery-title"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["ipad-close-film"].exists, "Reading alone has not submitted the chapter")
        let checks = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "evidence-check-"))
        for i in 0..<checks.count {
            let check = app.buttons["evidence-check-\(i)"]
            for _ in 0..<12 { if check.isHittable { break }; app.swipeUp() }
            check.tap()
        }
        let submit = app.buttons["expedition-submit"]
        for _ in 0..<12 { if submit.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(submit.isEnabled); submit.tap()
        let close = app.buttons["ipad-close-film"]
        XCTAssertTrue(close.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["林岚的阶段回信"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Navigation QA · 「星光调查卡」已归档")).firstMatch.exists)
        let timer = app.staticTexts["ipad-film-time"]
        expectation(for: NSPredicate(format: "label != %@", "已播放 0 秒"), evaluatedWith: timer)
        waitForExpectations(timeout: 10)
        capture("completion-film-auto-playing")
        app.buttons["ipad-film-transcript"].tap()
        let musicCredit = app.staticTexts["ipad-film-music-credit"]
        XCTAssertTrue(musicCredit.waitForExistence(timeout: 5))
        XCTAssertTrue(musicCredit.label.contains("PeriTune"))
        capture("completion-film-licensed-music-credit")
        app.buttons["收起"].tap()
        app.buttons["ipad-film-surface"].tap()
        XCTAssertTrue(close.isHittable); close.tap()
        let replay = app.buttons["expedition-replay-completion"]
        XCTAssertTrue(replay.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["这一章，你有了自己的成果"].exists)
        XCTAssertFalse(close.exists)
        capture("completion-film-closed-receipt")
        replay.tap(); XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .portrait
        let next = app.buttons["ipad-film-continue"]
        expectation(for: NSPredicate(format: "label CONTAINS %@", "进入「整理来自望远镜的数据」"), evaluatedWith: next)
        waitForExpectations(timeout: 10)
        XCTAssertTrue(next.isHittable); XCTAssertTrue(close.isHittable)
        capture("completion-film-finished-portrait")
        next.tap()
        let chapter = app.staticTexts["expedition-chapter-title"]
        XCTAssertTrue(chapter.waitForExistence(timeout: 15))
        XCTAssertEqual(chapter.label, "整理来自望远镜的数据")
        app.terminate(); app.launch(); enter(app)
        XCTAssertTrue(chapter.waitForExistence(timeout: 15))
        XCTAssertEqual(chapter.label, "整理来自望远镜的数据")
        XCTAssertFalse(close.exists)
        app.buttons["expedition-archive"].tap()
        app.staticTexts["星光调查卡"].tap()
        XCTAssertTrue(replay.waitForExistence(timeout: 10))
        XCTAssertFalse(close.exists, "Opening an archived receipt does not replay automatically")
        replay.tap(); XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(next.label.contains("返回作品")); next.tap()
        XCTAssertTrue(replay.waitForExistence(timeout: 10))
        capture("completion-film-archive-replay")
    }

    @MainActor func testCurrentMapCardContinuesTheOnlyUnlockedChapter() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = app(); enter(app); join(app)
        XCTAssertTrue(app.staticTexts["expedition-overview-question"].exists)
        capture("expedition-project-overview")
        let current = app.buttons["expedition-map-current"]
        for _ in 0..<5 { if current.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(current.isHittable, app.debugDescription)
        XCTAssertEqual(app.buttons.matching(identifier: "expedition-map-current").count, 1)
        XCTAssertFalse(app.buttons["expedition-stop-research-P1"].exists)
        capture("expedition-detailed-task-map")
        current.tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10))
        app.buttons["ipad-film-continue"].tap()
        XCTAssertTrue(app.webViews.firstMatch.staticTexts["Starling，这是你的任务"].waitForExistence(timeout: 20))
        capture("expedition-personalized-classroom")
    }

}
