# Full Molecule Course Renumbering Implementation Plan

**Status:** User confirmed 2026-09-12: numbering, paths and persistent IDs must agree. Display-only proposal superseded. Work in the existing dirty workspace; no unrelated commits, no subagents.

**Implementation checkpoint (2026-09-14):** Tasks 1–7 completed. Candidate-v5 passed source/hash/47-node/437-slide/364-SVG-path checks and was deployed through a write freeze with exact rollback backups. Canonical source is now consecutive-v2; the full legacy source is retained outside projects_data. See `docs/deployments/2026-09-14-molecule-numbering-v2.md`. Historical candidate verification now requires `--source /Users/xinghan/Dev/systemeduidea/course-backups/molecule-monster-hunter-legacy-v1-20260914`; never run the one-way builder over the activated source.

**Goal:** Renumber the 47 existing molecule-monster-hunter modules M01–M47, including the content graph, node folders, active slides, frontend references, canonical URLs and student record associations.

**Architecture:** An immutable old→new map is the only conversion authority. Content is transformed once into a fresh candidate directory; original snapshots and learner-authored prose are preserved. New URLs use /learn/<slug>/v2/Mxx; old routes map old IDs once. Database migration uses temporary IDs in one transaction to avoid old/new collisions, with an audit marker and row-key backup; no automatic repeated conversion. Existing opaque AI checkpoint identity remains stable through an explicit reverse lookup. No production migration is executed until the whole candidate and write-freeze/rollback procedure have been verified.

**Tech Stack:** Existing Python stdlib/SQLAlchemy, TypeScript/Next.js; no new package.

## Tasks

1. Author mapping in packages/student-web/src/lib/data/molecule-numbering-v2.json and test all 47 IDs, sequence, old/new collisions and legacy routing.
2. Implement scripts/course_migrations/molecule_numbering.py plus tests: JSON structural fields, markdown course refs, HTML visible text and safe attributes only (never SVG path commands); retain binary media unchanged; generate manifest, source hashes, audit and rollback-safe output. Verify graph links, source files and per-node slide count.
3. Implement explicit student DB migration with per-row audit and two-phase identifiers for progress, completion, badges, drills, chats, notes, submissions, exercise attempts and facts. Scope only this project; retain all learner text and row IDs; dry-run default; fail on unknown ID or unfamiliar schema. Test collisions, dry-run, rollback and repeated application.
4. Add versioned routes and central lesson URL helper; preserve old URLs through old→new redirect. Update all lesson navigation callsites, preview entry and existing renderer labels/export module fields. Migrate only known old browser record keys, retain old backups and schema compatibility.
5. Add stale-client write guard, activated only with the production numbering marker; version-tag new frontend requests. Avoid accepting old-page writes as new-numbered IDs. Preserve existing AI checkpoint identities.
6. Run focused tests and local browser of M07 plus contiguous catalog, check 47-node mapping and cross references. Generate deployment package/report and explicitly list any remaining embedded old-number audio/raster or active reference blockers.
7. Cutover is a separate reviewed operational step: pause writes, DB/content/web backups, migrate records, import verified content, enable new frontend/guard, verify identities and progress counts, then resume. Rollback is exact transaction audit plus retained content/web backups, not reverse-regex edits.

## Acceptance

No node added/dropped; M23(old)→M07 and M51(old)→M23 are distinct. An existing M23 URL never silently opens the new M23. Other projects and all student-authored contents unchanged. New references are computed in a single pass. SVG path data unchanged. Production is not declared migrated merely because a local preview is correct.
