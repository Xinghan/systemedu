import XCTest

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
        web.buttons["关闭面板"].tap(); XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
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
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
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
        let advance = app.buttons["expedition-next-chapter"]
        XCTAssertTrue(advance.waitForExistence(timeout: 10)); capture("expedition-signed-delivery")
        if !advance.isHittable { app.swipeUp() }; advance.tap()
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "星光为什么变暗了")
        capture("expedition-chapter-two-handoff")
        app.terminate(); app.launch(); enter(app)
        XCTAssertEqual(app.staticTexts["expedition-chapter-title"].label, "星光为什么变暗了")
        app.buttons["expedition-archive"].tap(); XCTAssertTrue(app.staticTexts["第一份星球观测"].waitForExistence(timeout: 10))
    }

}
