import XCTest

final class TabletMissionTests: XCTestCase {
    @MainActor private func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    @MainActor func testIPadMarsHomeFilmMapClassroomAndRestore() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons["ipad-resume"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["ipad-resume"].isHittable)
        capture("iPad-Mars-home")
        app.buttons["ipad-opening-film"].tap()
        XCTAssertTrue(app.buttons["ipad-film-play"].waitForExistence(timeout: 10)); app.buttons["ipad-film-play"].tap()
        let timer = app.staticTexts["ipad-film-time"]
        let advancing = NSPredicate(format: "label MATCHES %@", "已播放 [1-9][0-9]* 秒")
        expectation(for: advancing, evaluatedWith: timer); waitForExpectations(timeout: 15)
        app.buttons["暂停"].tap(); capture("iPad-Mars-film"); app.buttons["完成"].tap()
        app.buttons["ipad-area-map"].tap()
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
        app.terminate(); app.launch(); app.buttons["ipad-resume"].tap()
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
    @MainActor func testIPadDossierEditsSurviveRelaunch() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons["ipad-area-dossier"].waitForExistence(timeout: 15)); app.buttons["ipad-area-dossier"].tap()
        let web = app.webViews.firstMatch
        let goal = web.textFields.matching(NSPredicate(format: "label CONTAINS %@", "这次远征要观察什么？")).firstMatch
        XCTAssertTrue(goal.waitForExistence(timeout: 20))
        let marker = "iPad-trial-" + String(UUID().uuidString.prefix(6))
        goal.tap(); goal.typeText(marker)
        web.staticTexts["同一个目标，一路积累的作品。"].tap()
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 10))
        app.terminate(); app.launch(); app.buttons["ipad-area-dossier"].tap()
        XCTAssertTrue(goal.waitForExistence(timeout: 20)); XCTAssertTrue((goal.value as? String)?.contains(marker) == true)
        capture("iPad-Mars-dossier")
        app.buttons["ipad-area-home"].tap()
    }

}
