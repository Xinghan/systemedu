import XCTest

final class ClassroomJourneyTests: XCTestCase {
    @MainActor
    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor
    private func onScreen(_ element: XCUIElement, in container: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.isHittable, "Primary action must be usable without scrolling", file: file, line: line)
        XCTAssertTrue(container.frame.insetBy(dx: -1, dy: -1).contains(element.frame), "Primary action is outside the viewport", file: file, line: line)
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
