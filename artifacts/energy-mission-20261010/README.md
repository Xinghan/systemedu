# Energy laboratory mission — local acceptance

Scope: 8 indoor laboratory stations; 87 existing main lesson nodes, 14 optional support nodes and 3 micro entries. All 58 pvlib nodes keep their original sequence and record scopes. Source design and mapping are in systemeduidea/project_lines/energy-motion/mission.

All final plates and the cutaway map are unoccupied indoor laboratories. Scenic/coastal drafts were rejected and are not part of this delivery. Source PNGs and complete prompts are retained here; runtime WebP/MP4/VTT are under packages/student-web/public/mission/energy. Movies combine these stills, authored procedural canvas animation, narration and timed captions. They are not live-action scientific evidence.

## Reproduce

Run from the systemedu repository root. Use its existing @playwright/test dependency and Chromium; an isolated worktree can use NODE_PATH pointed at an existing root node_modules. FFmpeg and the configured course TTS backend are required only to regenerate films, not for playback. Keep systemeduidea as a sibling source checkout for full classroom fixtures.

- python3 tools/mission-authoring/build-energy-mission.py --idea-root ../systemeduidea
- Python environment with systemedu installed: run voices.py (uses configured TTS; 32 saved voice clips are already supplied).
- node artifacts/energy-mission-20261010/render-films.mjs
- python3 artifacts/energy-mission-20261010/compose.py
- python3 artifacts/energy-mission-20261010/verify-content.py
- Start student-web on port 4017, then run verify-browser.mjs, verify-films.mjs, verify-full-course.mjs and verify-support.mjs.
- node artifacts/energy-mission-20261010/verify-types.cjs 9bcbc32a
- node artifacts/energy-mission-20261010/verify-lint.cjs 9bcbc32a
- npm run build from packages/student-web.

The silent MP4 intermediates are ignored; final narrated movies, 32 source narration clips, stills and QA frames are retained. Source image variants and hashes are listed in image-prompts.json.

## Results and limits

All targeted checks passed against the local production build. See summary.json and individual reports. Browser checks cover independent account/guest scopes, restored records after local cache removal, timers/blockers/dossier, course handoffs, authorized download, login/enrollment return, automatic stage films and replay, failure/reduced-motion behavior, 320/390px layouts, and legacy support routes. The account API is mocked for these checks; no claim of a new live database test.

Production build passed. Baseline comparison retains 6 pre-existing TypeScript errors and 2 pre-existing lint errors, with no new errors. These checks do not certify real hardware, research outcomes, teacher approval or production deployment. Other missing project lines remain separate work.
