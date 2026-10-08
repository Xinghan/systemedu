# PurpleAir M19–M20 remake v2

Status: mapped and published to production after local review.

Art direction is locked to the M04–M14 baseline: warm off-white paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, and ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, flowers, UI, labels, embedded text, and decorative scenery.

## M19 — count versus inferred mass

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M19-w0-module/images/remake-v2/`

| Slide | Candidate |
| --- | --- |
| s1 | `s1.count-and-mass-streams.v2.png` |
| s2 | `s2.counting-versus-weighing-beads.v2.png` |
| s3 | `s3.no-scale-assumption-lens.v2.png` |
| s4 | `s4.humidity-swells-particles.v2.png` |
| s9 | `s9.sort-count-and-inference-workflow.v2.png` |
| s10 | `s10.evidence-and-inference-bridge.v2.png` |
| s11 | `s11.ready-for-calibration.v2.png` |

## M20 — ordinary and weighted means

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M20-w0-module/images/remake-v2/`

| Slide | Candidate |
| --- | --- |
| s1 | `s1.many-readings-one-summary.v2.png` |
| s2 | `s2.mean-as-balance-point.v2.png` |
| s3 | `s3.equal-share-average-workflow.v2.png` |
| s4 | `s4.weighted-mean-heavy-pulls.v2.png` |
| s5 | `s5.equal-weights-special-case.v2.png` |
| s10 | `s10.compare-two-averages-workflow.v2.png` |
| s11 | `s11.means-foundation-for-nowcast.v2.png` |

## Release record

- All fourteen `payload.images[].src` values now point to these candidates; original images remain rollback material.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 645 files.
- The single-course import and publish completed successfully (`publish:200`) without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains seven v2 mappings for M19 and seven for M20; representative image URLs return `200 image/png`.
