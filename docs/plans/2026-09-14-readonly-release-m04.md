# Read-only release, then M04

User explicitly requested deployment followed by continued generation.

1. Preflight: live build, service health, disk/inode capacity. Preserve all production rollback backups and learner data. Clean only disposable npm cache if needed; no full `all` deployment.
2. Finish M03 s2/s7 actual motion checks. Current browser blocker: Mac locked; user has been asked to unlock. Do not switch production before this check.
3. Stage a narrow release from production baseline. Only M01/M02/M03/M08 lecture renderers, read-only player support, eight course JSON files and manifest. Do not include unrelated dirty local frontend/backend changes.
4. Build in an isolated directory, validate content/hash boundaries, backup, publish with the established normal-importer atomic-swap approach. Run each stage separately. Verify services, HTTPS and exact Library slide payloads, then record release/rollback information.
5. After deployment, use the existing approved read-only design to convert M04's 9 pages: RDKit comparison, automatic source-backed 3D OH inspection, existing informational phase image, exact computed values/trace and reference report. Record per-slide decisions before implementation. No media quotas, no personal forms/storage. Preview and test the new batch separately; do not silently include it in the earlier release.

## Preflight result

Live build `wePmenNJ5nB7jso6BM2a9`; web/backend/worker/library active. Root free ~381 MB, tmpfs free 5.8 GB; `/root/.npm/_cacache` ~863 MB. Historical releases ~21 GB remain out of cleanup scope.

## Previous checkpoint — not deployed at that time

- Removed only disposable npm download cache with `npm cache clean --force`; root free rose to ~1.3 GB. Historical rollback backups, course files and student data unchanged.
- Downloaded four specific frontend source files as the production baseline. Narrow package built under `artifacts/readonly-release-20260914`: 11 frontend files, eight lecture JSON files plus manifest, 34 slides. The teacher/player patch excludes unrelated local preview/EMG changes; dispatcher changes only M01/M02/M03 class bindings. M08 and 3D changes are scoped read-only implementations.
- 157 frontend tests and two M08 Python trace tests pass. Exact M03 Python snippet executed and matches all four reference structures.
- Mac is locked; user was asked asynchronously to unlock for M03 s2/s7 browser verification. No browser access attempted through another channel.
- Upload attempt exited 255 with password authentication failure. Some temporary upload files/directory may exist, but no `stage`, build, pause, import, live switch or service restart was invoked. A retry explicitly sourcing the previously working local secret was rejected before execution by auto-review (`Selected model is at capacity`). Do not infer which transport files exist; inspect before next upload.
- Plan execution paused at the boundary per `executing-plans`. Production remains the prior build. Next turn: confirm Mac unlock, retry authorized transport after approval service recovery, complete browser checks, stage/build, and proceed with the gated release. M04 generation remains after the requested deployment.

## Current checkpoint — deployment completed

- Mac/browser access recovered; M03 s2/s7 real WebGL, automatic start/end states, pause, replay, retained complete table and no internal controls verified. Exact release-hash-bound browser record uploaded.
- Isolated staging and build passed. Stepwise maintenance/backup, importer publish, exact file and DB verification, service start, API verification and public resume all completed.
- Live build `ZfGjTkWmIZmJ4F16Si-91`. M01/M02/M03/M08, 34 slides, read-only; no new audio. Other nodes unchanged. Five services active; nginx HTTPS and external M03 HTTPS return 200.
- Release record: `docs/deployments/2026-09-14-readonly.md`. Root free ~698 MB; preserve historical backups and address capacity before another release.
- Latest user request was deployment. No M04 content was included or newly generated during this deployment turn; the next continuation remains M04, in order.

## Subsequent authorized storage cleanup

User requested verification and deletion of superseded release payloads. Completed 2026-09-14: 42 old frontend/course copies or archives across 12 historical releases removed; all database backups, latest full rollback, and numbering migration retained. Free disk now about 18G (53% used). Protected-path snapshots, backup hashes and six services/HTTP health checks passed. See `docs/deployments/2026-09-14-storage-cleanup.md` before referring to older rollback directories.
