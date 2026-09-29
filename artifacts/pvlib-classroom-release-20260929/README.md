# pvlib shared-classroom production release — 2026-09-29

Release status: deployed and verified. Both candidate and production passed the 58-node browser suite and real public-page checks; server integrity verification passed. Production build is `bchoKNftDtuWBobX7IWqd`.

## Scope

- Deploy the seven frontend files from classroom repair `26b6c9e6`, as merged into `main` at `3b04d899849a754465932dbb89091edc80518707`.
- Apply those committed changes to the existing production frontend with a three-way merge. Preserve production's lesson carousel and slideshow renderer. The one merge conflict was the carousel versus the new `beforeContent` slot; retain both, carousel first.
- Return pvlib lessons to the shared classroom: inline animation/game cards, the existing slideshow, notebook and final delivery. Old media URLs still open the corresponding classroom dialog.
- Keep raw course-content version hashing unchanged, so existing notebook and assignment records retain their scopes.
- No course import, backend update, database migration, or real student record writes. Existing cover assets remain unchanged.

## Release identity and rollback

- Previous frontend build: `jWXT9095sDPvOjv2xVUXs`.
- Candidate build: `bchoKNftDtuWBobX7IWqd`.
- Server release directory: `/opt/systemedu/releases/pvlib-classroom-20260929`.
- Candidate preview: loopback port 14002, accessed through local SSH port 14902.
- Before publishing, compare source/public-file hashes to the baseline and reject concurrent frontend changes. Preserve previous static chunks for already-open browser tabs.
- The previous frontend is retained at `student-web-before` inside the release directory. `bash scripts/releases/pvlib-classroom-20260929.sh rollback` restores it, refusing to overwrite later source/public-file changes.

## Verification scope

`candidate/verification.json` and `production/verification.json` describe browser checks against the built frontend, with reviewed authored course files and intercepted API fixtures. The suite traverses all 58 nodes using the course directory, checks shared reader elements and inline media anchors, exercises old game/animation/3D links, iframe message validation, artifact save/restore contracts, previous notebook restoration, account switching, slides, authenticated download contracts, and a 390px layout.

These fixture checks do **not** claim real-account authorization or production database round trips. Public checks separately use real anonymous production GET requests: project metadata, desktop/mobile catalog and detail pages, responsive cover loading, login redirect, and 401 responses for protected course files. No fake token is sent to a real backend.

The local-only Lightkurve preview regression in the general verification script is skipped for this deployment mode because local previews are unavailable on production.

Screenshot review caught a frame taken before the floating slide's ResizeObserver finished fitting the sheet. The verifier now waits for a visible, nonempty slide heading before capture. `production-slides/verification.json` records the passing targeted follow-up against production; `production/M01-shared-slideshow.png` is its completed-layout capture. The premature candidate screenshot was discarded. No additional frontend change was required.

Server verification compares frontend hashes to the expected seven-file patch; backend source, catalog and all existing pvlib course bytes must match their pre-release hashes. All three services must remain active.

## Commands

```sh
python3 scripts/releases/prepare-pvlib-classroom-20260929.py
bash scripts/releases/pvlib-classroom-20260929.sh upload
bash scripts/releases/pvlib-classroom-20260929.sh stage
bash scripts/releases/pvlib-classroom-20260929.sh build
bash scripts/releases/pvlib-classroom-20260929.sh preview
bash scripts/releases/pvlib-classroom-20260929.sh tunnel

PVLIB_ORIGIN=http://127.0.0.1:14902 \
PVLIB_OUTPUT=artifacts/pvlib-classroom-release-20260929/candidate \
PVLIB_CANONICAL_ONLY=1 PVLIB_BUILD=bchoKNftDtuWBobX7IWqd \
node scripts/verify-pvlib-classroom.mjs
node scripts/releases/verify-pvlib-classroom-public-20260929.mjs \
  http://127.0.0.1:14902 candidate bchoKNftDtuWBobX7IWqd

bash scripts/releases/pvlib-classroom-20260929.sh verification-evidence
bash scripts/releases/pvlib-classroom-20260929.sh publish
bash scripts/releases/pvlib-classroom-20260929.sh verify

PVLIB_ORIGIN=https://systeme.xin \
PVLIB_OUTPUT=artifacts/pvlib-classroom-release-20260929/production \
PVLIB_CANONICAL_ONLY=1 PVLIB_BUILD=bchoKNftDtuWBobX7IWqd \
node scripts/verify-pvlib-classroom.mjs
node scripts/releases/verify-pvlib-classroom-public-20260929.mjs \
  https://systeme.xin production bchoKNftDtuWBobX7IWqd
```

This release directory is single-use. The commands are a record of the release procedure, not an idempotent deployment workflow.
