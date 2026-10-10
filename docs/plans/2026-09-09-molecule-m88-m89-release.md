# M88 / M89 slide replacement and scoped release Implementation Plan

**Goal:** Generate and verify all 22 M88/M89 slides, then deploy M87–M89 (32 pages) to the existing student application.

**Architecture:** Versioned course snapshots and teaching drafts; pure deterministic diversity and rejection models; one typed React renderer with exact RDKit-produced structures and KaTeX formulas. Stage from live production and overlay only required renderer files and three target course nodes. Preserve unrelated local and production changes.

**Tech Stack:** Existing React/TypeScript/KaTeX; local RDKit 2026.03.3 for validated structure/fingerprint/scaffold assets; no new runtime dependency. Existing deploy.env, sshpass, import/publish, systemd frontend release switch.

## Tasks

1. Read original slides, lesson, theory and exercises. Snapshot six node files and record SHA256. Separate facts from overclaims; keep source IDs and anchors.
2. Generate a documented 16-structure instructional pool (not M87 synthetic identities), exact Morgan radius=2/2048-bit fingerprints and Murcko scaffolds. Verify computed matrix and depictions. Implement seeded-top-score MaxMin with deterministic ties and optional explicit similarity/scaffold constraints; never invent 10 groups or fill an infeasible set.
3. Implement and test rejection traces on source numerical examples: MW/logP/HBD/HBA, inclusive bounds, stop on first failure, pending/not-evaluated states, order sensitivity, missing fields and actual all-rule audit as a distinct mode.
4. Build 11 distinct source-aligned scenes per node: connected evidence, meaningful step/run/reset or input controls where justified, accessible exact notation, theme tokens and downloadable personal evidence. RDKit structures matter for M88 connectivity; 3D/raster do not carry the exact fingerprint/algorithm claim better. M89 needs actual rule traces, not people or decorative objects.
5. Produce revised narration and aligned lesson/theory/assignment/section content in isolated release directories for M87–M89. Old audio remains unbound; prior TTS external-send approval is not assumed.
6. Run pure model tests, source/mapping checks, formula rendering, scoped lint and real-browser review of all scenes plus key interactions. Record actual checks and limitations.
7. Stage live frontend/course snapshots with backups. Compare whitelisted file changes; build, loopback smoke, then switch frontend and publish only molecule-monster-hunter. Verify service health, API page equality, manifests, hashes and non-target nodes. Keep rollback assets.

## Deployment boundaries

Use individual steps, never deploy all. Do not upload local homepage, admin, enrollment changes, player UX or other projects. Publish explicitly unvoiced updated narration rather than mismatched old audio. No database schema or backend restart is required. Production data baseline changes during staging abort the release. No unrelated cleanup or git reset.

## Completion

2026-09-09: all seven tasks completed. M88/M89 22 new slides plus M87 10 slides published. Frontend build `aYd_CSg6L1f2Yf9XIjW4m`; server release `/opt/systemedu/releases/m87-m89-evidence-20260909`. The course API matched all 32 slides; other node files unchanged; web/backend/library active; HTTPS home/M88/M89 returned 200. Production browser reached the normal login page, so logged-in playback is left for user review.

Production backups stayed on the server. Initial build missing two shared renderer dependencies was corrected within the whitelist; package import initially failed because an excluded derived archive remained in manifest. The archive-only mismatch was verified, manifest repaired, package re-audited (729 entries, zero missing/size mismatches), and import/publish/verify succeeded. No raw production logs or course files were exported. Deployment control uploads now use atomic replacement.

After successful production verification, the 18 exact reviewed content files were synchronized to the local canonical course source, after checking each original SHA256. Only their 18 manifest entries, total size and update time were updated. Immutable original snapshots remain. This prevents the next ordinary course deployment from silently reverting these nodes. No other local course content was overwritten.

Evidence: `docs/slide-image-prompts/molecule-monster-hunter-M88-M89-evidence-v1.md` and `docs/deployments/2026-09-09-m87-m89-evidence.md`. Next node: M90. The whole project is not marked complete.
