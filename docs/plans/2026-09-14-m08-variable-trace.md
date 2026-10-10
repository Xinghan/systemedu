# M08 Variable Trace Implementation Plan

**Goal:** Remake the next consecutive module M08 (legacy M24), all 8 slides, then deploy.

**Architecture:** Preserve slide IDs and idea/theory anchors; typed code-trace payloads drive exact DOM code, binding table and console. Add a richer reusable trace renderer with step, play/pause, reset and static evidence. No arbitrary-code eval. Python verifies the authored examples offline. Keep legacy lessons and audio files archived; new narration unbinds old audio.

**Tech Stack:** Existing React / TypeScript / CSS; Python standard library for verification. No dependency change.

## Execution

1. Capture M08 original content and save the eight method decisions before authoring.
2. Add a dedicated rich code-trace component, initially route only explicit M08 aria labels to it; existing slides retain their renderer.
3. Author eight payloads: two-line outcome, provenance handoff, assignment syntax, lookup versus literal, reassignment, errors/fix, script evidence card, one-to-many bridge. Preserve identifiers, regenerate manifest.
4. Verify every authored runnable example with Python; test the 8-page mapping, anchors, narration unbinding, and state/output consistency. Run existing frontend tests.
5. Browser-check all pages at real slide size, step/reset/play/pause and layout. Mark new pages clearly in the unified preview.
6. Build scoped production delta against the just-published baseline, back up content/DB/frontend, import only verified full manifest using private memory staging, and verify M08 API plus unrelated-node hashes.

Existing dirty workspace remains in place, no unrelated commit/worktree manipulation and no subagents. The user already authorized continued implementation/deployment.

Completed 2026-09-14: all six steps verified and deployed, build `wePmenNJ5nB7jso6BM2a9`. See deployment receipt. Next M09; production disk capacity must be addressed before another release.
