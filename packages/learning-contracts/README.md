# Learning contracts

Draft-07 JSON schemas for the mobile release envelope and local host bridge, plus an exact fixture from the existing driving course. These contracts are validated in `learning-runtime/tests/contracts.test.mjs` and mirrored by native bridge validation.

The release schema is an additive proposal; there is no new server release endpoint in this batch. `driving-intro.json` is sourced from version-controlled course content and does not establish that this exact snapshot is published by the library service. Existing scope identifiers are preserved for future integration; local preview notes are separate.
