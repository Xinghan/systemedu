# ADR: 分子猎人连续编号与旧身份隔离

## Status
Accepted by user direction 2026-09-12; implementation under verification.

## Context
47 current modules retain IDs from a larger curriculum. Several IDs collide when renumbered: old M23 becomes M07 while old M51 becomes new M23. Numeric label substitution cannot distinguish old links or old browser writes.

## Decision
Use M01–M47 as actual new module IDs and sequential order. New canonical URLs have a v2 path segment; the original route is exclusively a legacy-ID redirect. Maintain a single mapping and explicit numbering marker. Keep historical authored content/receipts and opaque checkpoint identity; migrate association columns transactionally. Treat content migration, DB migration and frontend activation as a coordinated release with write freeze.

## Consequences
- Continuous user numbering agrees with new internal IDs.
- Old URLs remain unambiguous; new URLs gain one version segment.
- Requires an operational migration and guards against stale clients.
- A display-only approach was rejected by the user; in-place same-path reinterpretation was rejected because it would open the wrong course.
- Failure before cutover leaves production untouched. Failure during cutover requires restoring all three layers before enabling writes.
