# Synthetic crew portrait

`crew-full-body.jpg` is a synthetic, static cartoon illustration generated on 2026-11-27 by the application's existing Wan image-edit adapter from `packages/student-web/public/mission/space/expedition-v2/crew/engineer.png`.

It is not a student photograph. The provider returned a 2:3 illustration, sanitized to 683 × 1024 JPEG. Visual review confirmed that the head, hands, legs and both shoes are in frame. This fixture is included only in the UI test bundle, never the shipped app resources. UI tests seed it only into a UUID-isolated test database; the legacy test uses a cropped version to exercise the upgrade entry.
