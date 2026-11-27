# Expedition navigation and node films implementation plan

**Goal:** Restore project film replay and backward navigation while preserving sequential progress; add introduction/closing films at the agreed lesson granularity.

**Architecture:** Keep the existing classroom and all 120 stable node references. Native navigation owns review selection independently of persisted completion. Films have explicit replay/entry/continuation intent, so dismissal cannot accidentally advance or rewind a lesson.

**Tech Stack:** SwiftUI, AVKit, the existing WKWebView classroom, bundled JSON/media, XCTest/XCUITest.

1. Restore a persistent project introduction button and compact classroom navigation. Add a native route sheet containing all original chapters/nodes; allow completed nodes and the next current node, lock future nodes. Check review navigation never changes learning records or signed receipts.
2. Separate project/chapter film replay from first-entry actions. Test close, skip, replay and return to the same current progress in both iPad orientations.
3. Confirmed by the user: **14 chapters × introduction/closing = 28 films**, plus the separate project opening. Retain all 14 existing introductions and the approved research-P1 closing; produce the remaining 13 closings. Reuse existing chapter-film and receipt playback flows, and expose contextual replay without changing saved learning records.
4. Produce task-specific commander dialogue and dynamic character films for the confirmed batch, reuse the approved voice and licensed music, validate subtitles/media and exact node coverage. Do not present placeholder/static clips as completed films.
5. Run focused native and simulator navigation tests, inspect screenshots, record node mapping and verification. Commit only this task's explicit paths and push the current branch, verifying the remote SHA.

Status: navigation UI test passed; native regression and 13 closing films in progress. Existing unrelated workspace changes are excluded.
