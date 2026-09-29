# Flagship project cover release — 2026-09-29

Status: published as frontend build `jWXT9095sDPvOjv2xVUXs`. Candidate checks passed; server verification confirms exactly 42 frontend source/asset changes and unchanged backend source/public catalog. Public HTTPS browser verification is in progress.

## Problem and scope

The production library's “完整工程与研究” cards still used old course-service images or project-line snapshot covers. The eight individual editorial covers from commit `05bc1c26` existed in the repository but their production static URLs returned 404.

This release brings those existing approved images to production. It adds 480/800/1280px WebP variants, uses individual covers for service and snapshot cards, and updates detail hero images. Cards load lazily; the 480px and 800px images range from 28–94 KiB. Source artwork remains unchanged. Each asset filename contains its source digest so a refreshed page requests a new URL.

Eight projects: Mars rover, molecule discovery, EEG Minecraft, EMG hand, satellite archaeology, PurpleAir sensor, ant observation and Stirling controller. The previously generated pvlib responsive variants are packaged as well, so the shared helper has no missing asset references.

## Isolation

The candidate was built on the server from the current production frontend (`KbFMRmd6LHoM43bzsRIEY`), with only the cover assets, manifests, helper, three cover call sites and flagship card image sizing changed. It does not import the dirty local working tree or the un-deployed pvlib classroom repair.

Production source and rollback backup remain on the server. Frontend source hashes, backend source hashes and the public project catalog are checked before switching. No course manifests, content bundles, database migrations or student records are edited. Only the frontend service is restarted during switching.

## Reproduction and checks

- `scripts/generate-project-cover-variants.mjs`: generate each cover's variants from the corresponding `systemeduidea/projects_data/<slug>/cover-editorial-v3.png`.
- `scripts/releases/prepare-flagship-covers-20260929.py`: create the allowlisted asset archive and hashes.
- `scripts/releases/flagship-covers-20260929.{sh,py}`: stage, build, loopback preview, guarded publish, verify and rollback.
- `scripts/releases/verify-flagship-covers-20260929.mjs`: anonymous browser checks using public production metadata. Validates all 27 variant files byte-for-byte; all eight covers in normal and deliberately unavailable API states; desktop/mobile cards; five project lines; and the seven accessible project detail heroes. Asserts unique covers, consistent 3:2 frames and proportional cropping, no horizontal overflow, no old course-cover API requests, and no page exceptions. The deployed baseline mixed 180px frames with 3:2 frames depending on project line; this release unifies complete-engineering cards without importing unrelated local layout changes.

Candidate validation must pass before the publisher accepts its build ID. Production validation then repeats over HTTPS. Browser screenshots and JSON reports are kept in `candidate/` and `production/`.

The release is one-use and refuses to overwrite intervening frontend/backend/catalog changes. The rollback action likewise refuses to replace later frontend changes.

## Pre-existing issue outside the cover release

`molecule-monster-hunter` is listed in the public catalog, but its public detail API already returns HTTP 409 `course_numbering_mismatch` before this deployment. The current frontend displays “项目不存在” for that response. Its refreshed library card is verified normally; a working detail hero cannot be claimed. `detail-api-baseline.json` records the baseline. Verification explicitly checks that this known status is unchanged and rejects new API failures. Repairing course numbering is outside this cover-only frontend release and may involve student record compatibility.
