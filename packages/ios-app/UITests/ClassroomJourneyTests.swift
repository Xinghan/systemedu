import XCTest

final class ClassroomJourneyTests: XCTestCase {
    @MainActor
    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor
    private func onScreen(_ element: XCUIElement, in container: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.isHittable, "Primary action must be usable without scrolling", file: file, line: line)
        XCTAssertTrue(container.frame.insetBy(dx: -1, dy: -1).contains(element.frame), "Primary action \(element.frame) is outside viewport \(container.frame)", file: file, line: line)
    }
    @MainActor
    func testOfflineReaderPersistsPageAndNoteAcrossAppRelaunch() throws {
        let app = XCUIApplication(); app.launch()
        let reader = app.buttons["open-driving-intro"]
        onScreen(reader, in: app); reader.tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let contents = web.buttons["打开课文目录"]
        XCTAssertTrue(contents.waitForExistence(timeout: 15)); onScreen(contents, in: web); contents.tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "先认识这间实验室的四种输入")).firstMatch.tap()
        XCTAssertTrue(web.staticTexts["认识四种地形输入"].waitForExistence(timeout: 5))
        onScreen(web.staticTexts["正常前进是否合适？"], in: web)
        onScreen(web.buttons["下一页"], in: web)
        capture(app, name: "SystemEdu-table")
        web.buttons["下一页"].tap()
        XCTAssertTrue(web.staticTexts["sand，柔软沙地"].waitForExistence(timeout: 5))
        let notes = web.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "记笔记", "我的笔记")).firstMatch
        onScreen(notes, in: web); notes.tap()
        let field = web.textViews.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10)); field.tap()
        let marker = "mobile-" + String(UUID().uuidString.prefix(8))
        field.typeText(marker)
        let close = web.buttons["关闭面板"]
        onScreen(close, in: web)
        capture(app, name: "SystemEdu-note")
        close.tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 8))
        app.terminate(); app.launch(); app.buttons["continue-learning"].tap()
        XCTAssertTrue(app.webViews.staticTexts["sand，柔软沙地"].waitForExistence(timeout: 20))
        app.webViews.buttons["我的笔记"].tap()
        let restored = app.webViews.textViews.firstMatch
        XCTAssertTrue(restored.waitForExistence(timeout: 10))
        XCTAssertTrue((restored.value as? String)?.contains(marker) == true)
    }

    @MainActor
    func testCourseReadingSkipsAuthoringMetadataAndRestoresParagraph() throws {
        let app = XCUIApplication(); app.launch()
        app.buttons["all-courses"].tap()
        app.buttons["course-ai-ant-ethologist"].tap()
        app.buttons["node-M01"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["打开课文目录"].waitForExistence(timeout: 20))
        web.buttons["打开课文目录"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "确定观察问题与研究范围")).firstMatch.tap()
        XCTAssertFalse(web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Module: M01")).firstMatch.exists)
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "怎样把对蚂蚁的好奇")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertFalse(web.buttons["上一页"].isEnabled)
        capture(app, name: "Reader-first-page-without-metadata")
        web.buttons["下一页"].tap()
        let paragraph = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "一群蚂蚁从巢口进出")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 5))
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 8))
        app.terminate(); app.launch()
        app.buttons["continue-learning"].tap()
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "一群蚂蚁从巢口进出")).firstMatch.waitForExistence(timeout: 20))
    }

    @MainActor
    func testRevisedAntCourseOpensConceptLectureAndWorkbench() throws {
        let app = XCUIApplication(); app.launch()
        app.buttons["all-courses"].tap()
        app.buttons["course-ai-ant-ethologist"].tap()
        XCTAssertEqual(app.staticTexts["course-detail-title"].label, "AI 蚁群观察：测量、数据与研究记录")
        app.buttons["node-M01"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["打开课文目录"].waitForExistence(timeout: 20))
        web.buttons["讲课"].tap()
        XCTAssertTrue(web.staticTexts["确定观察问题与研究范围"].waitForExistence(timeout: 5))
        capture(app, name: "Ant-revised-lecture")
        web.buttons["关闭面板"].tap()
        web.buttons["打开课文目录"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "概念详解")).firstMatch.tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "研究问题与可检验的预测")).firstMatch.tap()
        XCTAssertTrue(web.staticTexts["研究问题与可检验的预测"].waitForExistence(timeout: 5))
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "概念自测")).firstMatch.tap()
        XCTAssertTrue(web.buttons["查看解析"].waitForExistence(timeout: 5))
        web.buttons["关闭面板"].tap()
        web.buttons["打开课文目录"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "课堂实践")).firstMatch.tap()
        web.buttons["下一页"].tap()
        web.buttons["下一页"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "我的观察计划")).firstMatch.tap()
        XCTAssertTrue(web.buttons["全屏操作"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.textViews.firstMatch.waitForExistence(timeout: 10), "The bundled workbench must execute in WKWebView")
        capture(app, name: "Ant-revised-workbench")
    }

    @MainActor
    func testHomeCatalogOpensCourseAndReturns() throws {
        let app = XCUIApplication(); app.launch()
        app.buttons["all-courses"].tap()
        let course = app.buttons["course-ai-ant-ethologist"]
        XCTAssertTrue(course.waitForExistence(timeout: 10))
        capture(app, name: "SystemEdu-catalog-cards")
        course.tap()
        XCTAssertTrue(app.buttons["node-M01"].waitForExistence(timeout: 10), "Home → all courses → course must open the outline")
        XCTAssertTrue(app.images["course-cover-ai-ant-ethologist"].waitForExistence(timeout: 10))
        onScreen(app.buttons["course-start"], in: app)
        capture(app, name: "SystemEdu-project-detail")
        app.buttons["course-introduction"].tap()
        XCTAssertTrue(app.navigationBars["项目介绍"].waitForExistence(timeout: 5))
        app.navigationBars.buttons["完成"].tap()
        app.buttons["course-start"].tap()
        XCTAssertTrue(app.webViews.buttons["练习与笔记"].waitForExistence(timeout: 20))
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["course-start"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(course.waitForExistence(timeout: 10))
        app.buttons["course-aloha-bimanual-apprentice"].tap()
        XCTAssertTrue(app.images["course-cover-aloha-bimanual-apprentice"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["course-detail-title"].label, "教会双臂一起干活")
        app.navigationBars.buttons.firstMatch.tap()
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["all-courses"].waitForExistence(timeout: 10))
    }

    @MainActor
    func testCatalogFiltersEmptyStateAndLandscapeActions() throws {
        let app = XCUIApplication(); app.launch()
        app.tabBars.buttons["探索"].tap()
        app.buttons["catalog-kind-filter"].tap()
        app.buttons["动手探索"].tap()
        XCTAssertEqual(app.staticTexts["catalog-count"].label, "14 项")
        let search = app.searchFields["搜索项目或课节"]
        search.tap(); search.typeText("no-such-course-94812")
        XCTAssertTrue(app.staticTexts["没有找到匹配的课程"].waitForExistence(timeout: 5))
        app.buttons["显示全部课程"].tap()
        XCTAssertEqual(app.staticTexts["catalog-count"].label, "58 项")
        search.tap(); search.typeText("Transformer")
        app.buttons["course-transformer-lab"].tap()
        XCTAssertTrue(app.buttons["course-start"].waitForExistence(timeout: 10))
        onScreen(app.buttons["course-start"], in: app)
        onScreen(app.buttons["node-M01"], in: app)
        capture(app, name: "SystemEdu-professional-detail")
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        // The simulator reports orientation before its rotation animation completes.
        // Wait for the actual landscape viewport and the full button bounds, not a delay.
        let settled = expectation(for: NSPredicate { _, _ in
            app.frame.width > app.frame.height && app.frame.insetBy(dx: -1, dy: -1).contains(app.buttons["course-start"].frame)
        }, evaluatedWith: app)
        wait(for: [settled], timeout: 8)
        onScreen(app.buttons["course-start"], in: app)
        let rendered = expectation(for: NSPredicate { _, _ in
            let size = XCUIScreen.main.screenshot().image.size
            return size.width > size.height
        }, evaluatedWith: app)
        wait(for: [rendered], timeout: 8)
        onScreen(app.buttons["node-M01"], in: app)
        capture(app, name: "SystemEdu-project-landscape")
    }

    @MainActor
    func testCatalogAtAccessibilityTextSize() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXL"]
        app.launch()
        app.tabBars.buttons["探索"].tap()
        let course = app.buttons["course-ai-ant-ethologist"]
        XCTAssertTrue(course.waitForExistence(timeout: 10)); course.tap()
        XCTAssertTrue(app.buttons["course-start"].waitForExistence(timeout: 10))
        onScreen(app.buttons["course-start"], in: app)
        onScreen(app.buttons["course-introduction"], in: app)
        capture(app, name: "SystemEdu-project-large-text")
    }

    @MainActor
    func testCatalogCourseReadingAndRecordRestore() throws {
        let app = XCUIApplication(); app.launch()
        app.tabBars.buttons["探索"].tap()
        let search = app.searchFields["搜索项目或课节"]
        XCTAssertTrue(search.waitForExistence(timeout: 10)); search.tap(); search.typeText("凌星")
        let course = app.buttons["course-lightkurve-transit-detective"]
        XCTAssertTrue(course.waitForExistence(timeout: 10)); course.tap()
        let node = app.buttons["node-M01"]
        XCTAssertTrue(node.waitForExistence(timeout: 10)); node.tap()
        let web = app.webViews.firstMatch
        let notes = web.buttons["练习与笔记"]
        XCTAssertTrue(notes.waitForExistence(timeout: 20)); onScreen(notes, in: web)
        capture(app, name: "SystemEdu-full-course")
        notes.tap()
        let field = web.textViews.matching(identifier: "course-note").firstMatch
        let note = field.exists ? field : web.textViews.allElementsBoundByIndex.last!
        XCTAssertTrue(note.waitForExistence(timeout: 10))
        note.tap(); note.typeText("ios-catalog-restoration")
        web.buttons["关闭面板"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        app.terminate(); app.launch(); app.buttons["continue-learning"].tap()
        XCTAssertTrue(app.webViews.buttons["练习与笔记"].waitForExistence(timeout: 20))
    }

    @MainActor
    func testBundledCourseExperimentRunsInSandbox() throws {
        let app = XCUIApplication(); app.launch()
        app.tabBars.buttons["探索"].tap()
        let search = app.searchFields["搜索项目或课节"]
        XCTAssertTrue(search.waitForExistence(timeout: 10)); search.tap(); search.typeText("夹爪碰到")
        let course = app.buttons["course-grasp-a-virtual-block"]
        XCTAssertTrue(course.waitForExistence(timeout: 10)); course.tap(); app.buttons["node-M01"].tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.buttons["资料与实践"].waitForExistence(timeout: 20)); web.buttons["资料与实践"].tap()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "让夹爪碰到目标")).firstMatch.tap()
        XCTAssertTrue(web.buttons["全屏操作"].waitForExistence(timeout: 10)); web.buttons["全屏操作"].tap()
        XCTAssertTrue(web.buttons["运行并保留本次实验"].waitForExistence(timeout: 30))
        capture(app, name: "SystemEdu-bundled-experiment")
    }

    @MainActor
    func testModelsAndPrimaryControlsStayOnScreen() throws {
        let app = XCUIApplication(); app.launch()
        for name in ["open-driving-intro", "open-mechanical-hand", "open-mars-landing"] { onScreen(app.buttons[name], in: app) }
        capture(app, name: "SystemEdu-home")
        app.buttons["open-mechanical-hand"].tap()
        let hand = app.webViews.firstMatch, preset = hand.buttons["五指合拢"]
        XCTAssertTrue(preset.waitForExistence(timeout: 30))
        let enabled = expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: preset)
        wait(for: [enabled], timeout: 30)
        for label in ["五指合拢", "张开手掌", "包握参考球", "更多操作", "动作原理"] { onScreen(hand.buttons[label], in: hand) }
        hand.buttons["张开手掌"].tap()
        capture(app, name: "SystemEdu-hand")
        preset.tap()
        hand.buttons["动作原理"].tap()
        XCTAssertTrue(hand.buttons["下一页"].waitForExistence(timeout: 5)); hand.buttons["下一页"].tap()
        XCTAssertTrue(hand.staticTexts["收回的绳长怎样计算"].waitForExistence(timeout: 5))
        hand.buttons["关闭面板"].tap()
        XCTAssertTrue(hand.staticTexts["已保存到本机"].waitForExistence(timeout: 8))
        app.navigationBars.buttons.firstMatch.tap()
        let landing = app.buttons["open-mars-landing"]
        onScreen(landing, in: app); landing.tap()
        let web = app.webViews.firstMatch, play = web.buttons["播放演示"]
        XCTAssertTrue(play.waitForExistence(timeout: 30))
        let ready = expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: play)
        wait(for: [ready], timeout: 30)
        for label in ["播放演示", "降落伞减速", "触地后飞离", "部件目录", "想一想"] { onScreen(web.buttons[label], in: web) }
        web.buttons["缆绳放下火星车"].tap()
        capture(app, name: "SystemEdu-landing")
        play.tap()
        XCTAssertTrue(web.buttons["暂停演示"].waitForExistence(timeout: 8))
        web.buttons["暂停演示"].tap()
        web.buttons["部件目录"].tap()
        // WebKit exposes aria-pressed buttons as switches in the iOS AX tree.
        let part = web.switches["动力下降级"]
        XCTAssertTrue(part.waitForExistence(timeout: 5)); onScreen(part, in: web); part.tap()
        XCTAssertTrue(web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "选中部件")).firstMatch.waitForExistence(timeout: 5))
    }
    @MainActor
    func testLandscapeKeepsModelControlsReachable() throws {
        let app = XCUIApplication(); app.launch()
        defer { XCUIDevice.shared.orientation = .portrait }
        app.buttons["open-mechanical-hand"].tap()
        XCTAssertTrue(app.webViews.buttons["五指合拢"].waitForExistence(timeout: 30))
        XCUIDevice.shared.orientation = .landscapeLeft
        for label in ["五指合拢", "更多操作", "动作原理"] { onScreen(app.webViews.buttons[label], in: app.webViews.firstMatch) }
        capture(app, name: "SystemEdu-hand-landscape")
        XCUIDevice.shared.orientation = .portrait
        app.navigationBars.buttons.firstMatch.tap()
        app.buttons["open-mars-landing"].tap()
        XCTAssertTrue(app.webViews.buttons["播放演示"].waitForExistence(timeout: 30))
        XCUIDevice.shared.orientation = .landscapeLeft
        for label in ["播放演示", "部件目录", "想一想"] { onScreen(app.webViews.buttons[label], in: app.webViews.firstMatch) }
        capture(app, name: "SystemEdu-landing-landscape")
    }

}
