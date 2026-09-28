# TeachOpenCADD local preview verification

Course: `teachopencadd-candidate-research`. Content and the runnable student practice kit live in the sibling `systemeduidea` repository. This directory preserves the app-side verification evidence; the course's `audit/` directory contains the independent scientific and visual reviews.

- `final-browser-check.json`: all 46 reading routes, 13 actual opaque-iframe artifact attachment paths, M33 guest assignment save/reload, all image/ZIP route bytes, and three mobile views.
- `final-browser-media-delta.json`: repeats the changed final media paths after synchronization, including read-only media labels and three representative screenshots.
- `records-check.json` and `preview-check.json`: separate classroom/assignment/quiz/exam records, representative reload persistence, foundations, slides and read-only diagrams.
- `preview-boundary-report.json`: 48 development-host, file-serving and artifact-message boundary assertions.
- `screenshots/`: local browser screenshots of the final synchronized course.

The scripts are retained as executed and refer to this author's local sibling checkout and `/private/tmp/cadd-authoring`. Adjust those paths before re-running elsewhere. Start student-web on port 4000 and keep the sibling course checkout available. Headless browser access may need host permission in a sandbox.

Verification used an isolated guest browser. Signed-in requests reuse the existing learning-record API, but this run did not impersonate a real account or assert a new database end-to-end result. A submitted filesystem path is not a file upload. The course has not been deployed or piloted with children. This course has narration scripts, not generated audio recordings.
