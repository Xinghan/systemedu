# Space mission curriculum — local review

See [implementation.md](implementation.md) for curriculum, scope preservation and unresolved physical bridges.

Verification:
- `node scripts/tests/space-mission-curriculum.cjs`: 85-source allocation, 62 main steps, cross-course order, progress and evidence invariants.
- `node scripts/verify-learning-record-session.cjs`: existing session conflict/retry regression.
- `.venv/bin/python -m pytest tests/student/test_learning_records.py -q`: 18 passed using temporary SQLite, including the new mission dossier scope and original-work isolation.
- `node artifacts/space-mission-curriculum-20261009/verify-browser.mjs`: desktop, 390px/320px, original classrooms, source revisions, guest/account separation, enrollment return, and compatible first-arrival films. Account responses are mocked; actual course content is read from the sibling idea repository. Requires local web at port 4000 and its existing API connection for guest GETs. No production writes.
- `npm run build` in `packages/student-web`: passed. The existing build configuration skips type validation.
- `verify-types.cjs` / `verify-lint.cjs`: compare with pre-change `f8ff7725`; 6 existing TypeScript and 5 existing lint errors remain, no added errors. Optional first argument selects a different baseline.

`generate-runtime.py` rebuilds the reference-only runtime map from the sibling `systemeduidea` audit design. It does not regenerate or renumber source lessons.

No deployment, real hardware validation, or new media generation in this batch. Screenshot account values are test fixtures.
