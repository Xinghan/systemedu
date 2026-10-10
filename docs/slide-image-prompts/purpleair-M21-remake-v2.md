# PurpleAir M21 remake v2

Status: mapped and published to production after local review.

Art direction is locked to the M04–M14 baseline: warm off-white paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, ample empty space, and flat paper-like metaphors. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, scenery, flowers, UI, labels and embedded text.

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M21-w0-module/images/remake-v2/`

| Slide | Candidate |
| --- | --- |
| s1 | `s1.precise-recentness-rule.v2.png` |
| s2 | `s2.multiplying-decay-chain.v2.png` |
| s3 | `s3.halving-geometric-bars.v2.png` |
| s4 | `s4.rolling-twelve-hour-window.v2.png` |
| s5 | `s5.stable-versus-responsive-knob.v2.png` |
| s10 | `s10.draw-decaying-weights-workflow.v2.png` |
| s11 | `s11.nowcast-heart-components.v2.png` |

## Release record

- All seven `payload.images[].src` values now point to the v2 candidates; original images remain rollback material.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 652 files.
- A clean course archive was uploaded to a temporary production path and verified by SHA-256 before the atomic import and publish (`publish:200`), without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains seven v2 mappings for M21; representative image URLs return `200 image/png`.
