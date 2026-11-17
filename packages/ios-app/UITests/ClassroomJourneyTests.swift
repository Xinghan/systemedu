import XCTest

final class ClassroomJourneyTests: XCTestCase {
    @MainActor
    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor
    private func scrollPage(_ web: XCUIElement) {
        // The model intentionally consumes drags for rotation. Scroll in the page gutter.
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.985, dy: 0.82))
            .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: 0.985, dy: 0.22)))
    }
    @MainActor
    func testOfflineReaderPersistsNoteAcrossAppRelaunch() throws {
        let app = XCUIApplication()
        app.launch()
        app.tabBars.buttons["探索"].tap()
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "先看路，再决定")).firstMatch.tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let field = web.textViews.firstMatch
        for _ in 0..<12 where !field.isHittable { web.swipeUp() }
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.tap()
        let marker = "观察笔记-" + String(UUID().uuidString.prefix(8))
        field.typeText(marker)
        XCTAssertTrue(web.staticTexts["已保存到本机"].waitForExistence(timeout: 8))
        app.terminate(); app.launch()
        app.buttons["continue-learning"].tap()
        let restored = app.webViews.textViews.firstMatch
        XCTAssertTrue(restored.waitForExistence(timeout: 20))
        XCTAssertTrue((restored.value as? String)?.contains(marker) == true)
    }

    @MainActor
    func testBothBundledModelsLoadAndControlsRespond() throws {
        let app = XCUIApplication(); app.launch()
        capture(app, name: "SystemEdu-home")
        app.buttons["open-mechanical-hand"].tap()
        let hand = app.webViews.firstMatch
        let preset = hand.buttons.matching(NSPredicate(format: "label CONTAINS %@", "五指合拢")).firstMatch
        XCTAssertTrue(preset.waitForExistence(timeout: 30))
        let enabled = expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: preset)
        wait(for: [enabled], timeout: 30)
        capture(app, name: "SystemEdu-hand")
        for _ in 0..<8 where !preset.isHittable { scrollPage(hand) }
        preset.tap()
        XCTAssertTrue(hand.staticTexts["已保存到本机"].waitForExistence(timeout: 8))
        app.navigationBars.buttons.firstMatch.tap()
        let landing = app.buttons["open-mars-landing"]
        for _ in 0..<4 where !landing.isHittable { app.swipeUp() }
        landing.tap()
        let play = app.webViews.buttons["播放演示"]
        XCTAssertTrue(play.waitForExistence(timeout: 30))
        let ready = expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: play)
        wait(for: [ready], timeout: 30)
        capture(app, name: "SystemEdu-landing")
        for _ in 0..<8 where !play.isHittable { scrollPage(app.webViews.firstMatch) }
        play.tap()
        XCTAssertTrue(app.webViews.buttons["暂停演示"].waitForExistence(timeout: 8))
    }
}
