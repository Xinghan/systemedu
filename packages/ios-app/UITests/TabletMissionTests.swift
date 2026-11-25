import XCTest

final class TabletMissionTests: XCTestCase {
    @MainActor private func freshApp(openProject: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["SYSTEMEDU_TEST_STORE"] = UUID().uuidString
        app.launch()
        if openProject { enterProject(app) }
        return app
    }

    @MainActor private func enterProject(_ app: XCUIApplication) {
        let project = app.buttons["ipad-project-space"]
        XCTAssertTrue(project.waitForExistence(timeout: 15))
        project.tap()
    }

    @MainActor private func openHandbook(_ title: String, in app: XCUIApplication) {
        if app.buttons["ipad-project-space"].exists { enterProject(app) }
        let menu = app.buttons["ipad-mission-menu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        menu.tap()
        app.buttons[title].tap()
    }

    @MainActor private func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    @MainActor func testIPadMarsHomeFilmMapClassroomAndRestore() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = freshApp()
        XCTAssertTrue(app.buttons["ipad-resume"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["ipad-resume"].isHittable)
        XCTAssertEqual(app.buttons["ipad-resume"].label, "进入第一阶段")
        XCTAssertFalse(app.buttons["任务地图"].exists)
        capture("iPad-Mars-home")
        XCUIDevice.shared.orientation = .portrait
        let portraitHome = expectation(for: NSPredicate { _, _ in
            let frame = app.frame
            let film = app.buttons["ipad-opening-film"].frame
            let learn = app.buttons["ipad-resume"].frame
            return frame.height > frame.width && frame.contains(film) && frame.contains(learn)
        }, evaluatedWith: app)
        wait(for: [portraitHome], timeout: 12)
        XCTAssertTrue(app.buttons["ipad-opening-film"].isHittable)
        XCTAssertTrue(app.buttons["ipad-resume"].isHittable)
        capture("iPad-Mars-home-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        app.buttons["ipad-opening-film"].tap()
        XCTAssertTrue(app.buttons["ipad-film-play"].waitForExistence(timeout: 10))
        let timer = app.staticTexts["ipad-film-time"]
        let advancing = NSPredicate(format: "label MATCHES %@", "已播放 [1-9][0-9]* 秒")
        expectation(for: advancing, evaluatedWith: timer); waitForExpectations(timeout: 15)
        app.buttons["ipad-film-play"].tap()
        let picture = app.descendants(matching: .any).matching(identifier: "ipad-film-player").firstMatch
        XCTAssertTrue(picture.exists)
        XCTAssertGreaterThan(picture.frame.width, app.frame.width * 0.94)
        XCTAssertGreaterThan(picture.frame.height, app.frame.height * 0.92)
        let subtitles = app.buttons["ipad-film-subtitles"]
        let before = subtitles.value as? String
        subtitles.tap()
        XCTAssertNotEqual(subtitles.value as? String, before)
        subtitles.tap()
        XCTAssertEqual(subtitles.value as? String, before)
        app.buttons["ipad-film-transcript"].tap()
        XCTAssertTrue(app.staticTexts["完整字幕"].waitForExistence(timeout: 5))
        app.buttons["收起"].tap()
        capture("iPad-Mars-fullscreen-film")
        app.buttons["ipad-close-film"].tap()
        app.buttons["ipad-resume"].tap()
        app.buttons["ipad-stage-start"].tap()
        XCTAssertTrue(app.webViews.firstMatch.buttons["打开课文目录"].waitForExistence(timeout: 20))
        app.buttons["ipad-lesson-back"].tap()
        openHandbook("探测工程地图", in: app)
        XCTAssertTrue(app.buttons["ipad-station-mission-design"].waitForExistence(timeout: 5)); capture("iPad-Mars-map")
        app.buttons["ipad-station-mission-design"].tap()
        app.buttons["ipad-node-pick-an-observation-site:M01"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20))
        web.buttons["练习与笔记"].tap()
        let note = web.textViews.firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 5)); note.tap()
        let marker = "ipad-mars-" + String(UUID().uuidString.prefix(8)); note.typeText(marker)
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        web.buttons["动画与互动"].tap()
        web.buttons["进入实验：本节实验工作台"].tap()
        XCTAssertTrue(web.buttons["关闭面板"].waitForExistence(timeout: 10)); capture("iPad-Mars-workspace")
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        app.terminate(); app.launch(); enterProject(app)
        XCTAssertTrue(app.buttons["ipad-resume"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons["ipad-resume"].label, "继续学习")
        app.buttons["ipad-resume"].tap()
        app.buttons["ipad-stage-start"].tap()
        XCTAssertTrue(web.buttons["练习与笔记"].waitForExistence(timeout: 20)); web.buttons["练习与笔记"].tap()
        XCTAssertTrue(note.waitForExistence(timeout: 10)); XCTAssertTrue((note.value as? String)?.contains(marker) == true)
        capture("iPad-Mars-reading-and-note")
        web.buttons["关闭面板"].tap(); app.buttons["ipad-back-map"].tap()
        app.buttons["ipad-station-perception"].tap(); app.buttons["ipad-node-mars-analog-rover:M02"].tap()
        XCTAssertTrue(web.buttons["讲课"].waitForExistence(timeout: 20)); XCTAssertTrue(web.buttons["讲课"].isEnabled); web.buttons["讲课"].tap()
        XCTAssertTrue(web.buttons["关闭面板"].waitForExistence(timeout: 10)); capture("iPad-Mars-lecture")
        web.buttons["关闭面板"].tap(); app.buttons["ipad-back-map"].tap()
        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(app.buttons["ipad-station-first-contact"].waitForExistence(timeout: 10)); capture("iPad-Mars-map-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        app.buttons["ipad-area-home"].tap()
    }
    @MainActor func testProjectHomeLibraryAndVisualJourney() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = freshApp(openProject: false)
        XCTAssertTrue(app.staticTexts["ipad-home-title"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.staticTexts["ipad-home-title"].label, "我的项目")
        capture("iPad-app-home")
        app.buttons["ipad-home-library"].tap()
        XCTAssertTrue(app.buttons["ipad-browse-catalog"].exists)
        app.buttons["ipad-browse-catalog"].tap()
        XCTAssertTrue(app.searchFields.firstMatch.waitForExistence(timeout: 10))
        app.navigationBars.buttons.firstMatch.tap()
        enterProject(app)
        XCTAssertTrue(app.buttons["ipad-stage-first-contact"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["星际远航项目总览"].exists)
        capture("iPad-visual-journey")
        app.buttons["ipad-stage-first-contact"].tap()
        XCTAssertEqual(app.staticTexts["ipad-stage-title"].label, "启程观测港")
        XCTAssertTrue(app.buttons["ipad-stage-film"].exists)
        capture("iPad-first-stage")
        let next = app.buttons["ipad-stage-next"]
        if !next.isHittable { app.swipeUp() }
        next.tap()
        app.buttons["ipad-track-rover"].tap()
        XCTAssertEqual(app.staticTexts["ipad-stage-title"].label, "任务设计所")
        capture("iPad-second-stage")
        app.buttons["ipad-area-home"].tap()
        app.buttons["ipad-exit-project"].tap()
        XCTAssertTrue(app.buttons["ipad-project-space"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["ipad-home-title"].label, "我的项目")
    }

    @MainActor func testFirstObservationLeadsToBothResearchAndEngineering() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = freshApp()
        app.buttons["ipad-resume"].tap()
        app.buttons["ipad-stage-start"].tap()
        let choose = app.buttons["ipad-lesson-directions"]
        XCTAssertTrue(choose.waitForExistence(timeout: 15))
        choose.tap()
        for track in ["transit", "rover"] {
            let entry = app.buttons["ipad-track-" + track]
            XCTAssertTrue(entry.waitForExistence(timeout: 8))
            if !entry.isHittable { app.swipeUp() }
            entry.tap()
            app.buttons["ipad-stage-start"].tap()
            XCTAssertTrue(app.webViews.firstMatch.buttons["打开课文目录"].waitForExistence(timeout: 20))
            let expected = track == "transit" ? "从恒星的亮度变化提出研究问题" : "一张图片，也有自己的身份证"
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", expected)).firstMatch.exists)
            app.buttons["ipad-lesson-back"].tap()
            app.buttons["ipad-area-home"].tap()
            app.buttons["ipad-browse-tracks"].tap()
        }
    }

    @MainActor func testIPadDossierEditsSurviveRelaunch() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = freshApp()
        openHandbook("远征档案", in: app)
        let web = app.webViews.firstMatch
        let goal = web.textFields.matching(NSPredicate(format: "label CONTAINS %@", "这次远征要观察什么？")).firstMatch
        XCTAssertTrue(goal.waitForExistence(timeout: 20))
        let marker = "iPad-trial-" + String(UUID().uuidString.prefix(6))
        goal.tap(); goal.typeText(marker)
        web.staticTexts["同一个目标，一路积累的作品。"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        app.terminate(); app.launch(); openHandbook("远征档案", in: app)
        XCTAssertTrue(goal.waitForExistence(timeout: 20)); XCTAssertTrue((goal.value as? String)?.contains(marker) == true)
        capture("iPad-Mars-dossier")
        app.buttons["ipad-area-home"].tap()
    }

    @MainActor func testTransitEvidenceFromProjectLibrary() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = freshApp()
        openHandbook("项目资料", in: app)
        app.buttons["ipad-library-transit"].tap()
        let web = app.webViews.firstMatch
        let next = web.buttons["下一页"]
        XCTAssertTrue(next.waitForExistence(timeout: 20))
        web.buttons["打开课文目录"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "先描述看到的变化")).firstMatch.tap()
        let plot = web.images.matching(NSPredicate(format: "label CONTAINS %@", "Q3 的实测光变曲线")).firstMatch
        XCTAssertTrue(plot.waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "共 32 节")).firstMatch.exists)
        capture("Transit-Q3-real-data")
        let file = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Q3 观测表")).firstMatch
        XCTAssertTrue(file.exists)
        file.tap()
        XCTAssertTrue(web.staticTexts["321.4415"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts["323.5461"].exists)
        capture("Transit-Q3-measurements")
        web.buttons["写下我的观察"].tap()
        let note = web.textViews.firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 5))
        let marker = "Q3-" + String(UUID().uuidString.prefix(6))
        note.tap(); note.typeText(marker)
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 15))
        app.terminate()
        app.launch()
        openHandbook("项目资料", in: app)
        app.buttons["ipad-library-transit"].tap()
        XCTAssertTrue(plot.waitForExistence(timeout: 20))
        web.buttons["练习与笔记"].tap()
        XCTAssertTrue(note.waitForExistence(timeout: 5)); XCTAssertTrue((note.value as? String)?.contains(marker) == true)
        web.buttons["关闭面板"].tap()
        app.buttons["下一节"].tap()
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "第 2 节，共 32 节")).firstMatch.waitForExistence(timeout: 15))
    }

}
