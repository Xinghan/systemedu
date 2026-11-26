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
        app.buttons["完成"].tap(); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(app.buttons["ipad-film-continue"].waitForExistence(timeout: 10)); app.buttons["ipad-film-continue"].tap()
        XCTAssertTrue(web.buttons["下一页"].waitForExistence(timeout: 20))
        let first = web.staticTexts["任务阅读　01 / 08"], second = web.staticTexts["任务阅读　02 / 08"]
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        // Touch the reading surface, not its controls: real WKWebView gesture delivery.
        func swipe(_ left: Bool) {
            web.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.72 : 0.28, dy: 0.16))
                .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.28 : 0.72, dy: 0.16)))
        }
        swipe(true); XCTAssertTrue(second.waitForExistence(timeout: 5)); capture("ipad-reader-chapter-two-landscape")
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
        web.buttons["关闭面板"].tap(); XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
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
        let read = web.buttons["标记为已读完"]
        XCTAssertTrue(read.waitForExistence(timeout: 10))
        if !read.isHittable { web.swipeUp() }
        read.tap()
        XCTAssertTrue(web.buttons["已标记读完 · 撤销"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
        app.buttons["ipad-lesson-back"].tap()
        XCTAssertTrue(app.buttons["expedition-continue"].waitForExistence(timeout: 10)); app.buttons["expedition-continue"].tap()
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["expedition-delivery-title"].exists)
        XCTAssertFalse(app.buttons["expedition-next-step"].isEnabled)
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
