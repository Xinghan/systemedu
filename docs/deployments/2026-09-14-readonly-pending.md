# Read-only release — previous blocked checkpoint (resolved)

**2026-09-14 update:** deployment subsequently completed. See [final release record](2026-09-14-readonly.md). Production is now `ZfGjTkWmIZmJ4F16Si-91`, all 34 read-only slides are verified, and traffic has resumed. The paragraphs below preserve the earlier blocked checkpoint and are no longer current status.

Project: molecule-monster-hunter. Scope: M01/M02/M03/M08, 34 teacher slides. Existing production build remains `wePmenNJ5nB7jso6BM2a9`.

Preparation completed: scoped code/content tarballs and expected hashes in `artifacts/readonly-release-20260914`; stepwise scripts `scripts/releases/readonly-local.sh` and `readonly-release.py`. 157 frontend tests plus independently executed M03/M08 snippets pass.

Production mutation limited to disposable npm cache cleanup (863 MB; free disk ~1.3 GB) and an attempted temporary-artifact upload. No live source, course/database, service config or process was changed. All historical backups retained.

Blockers: local Mac locked (required browser checks pending); upload failed password authentication once; explicit local-secret retry was denied before execution because the platform's auto-review model was at capacity. User was informed; no alternate execution channel used.

Resume from the plan `docs/plans/2026-09-14-readonly-release-m04.md`. The release's `pause` step requires a truthful browser verification record bound to the exact frontend hashes; no such file has been created. Do not deploy before that verification. Do not mark the progress ledger as production-complete. M04 is the next generation/conversion node after deployment.
