# PurpleAir M22 remake v2

Status: mapped and published to production after local review.

M22 originally used seven dark inline SVG diagrams. Each has been retired in favor of a mapped raster illustration. The visual contract is locked to warm off-white cotton paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, flat paper-like metaphors, and ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, scenery, UI, labels and embedded text.

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M22-w0-nowcast/images/remake-v2/`

| Slide | Candidate | Teaching relationship |
| --- | --- | --- |
| s1 | `s1.adaptive-weighting-two-weather-states.v2.png` | Stable broad weights versus abrupt-change steep weights |
| s2 | `s2.equal-average-lags-spike.v2.png` | Equal averaging lags behind a recent spike |
| s3 | `s3.range-relative-variation-dial.v2.png` | Spread, relative variation and dynamic weight setting |
| s4 | `s4.dynamic-nowcast-four-stage-workflow.v2.png` | Set weight, decay weights, sum, normalize |
| s5 | `s5.divide-by-total-weight.v2.png` | Normalize by total weight rather than fixed count |
| s10 | `s10.nowcast-formula-decomposition-notes.v2.png` | Learner reconstructs the four-part method |
| s11 | `s11.nowcast-components-complete.v2.png` | Complete dynamic weighted-average components |

## Release record

- The seven slide `payload.images[].src` values point to the v2 candidates and all seven corresponding `inline_svg` values are removed. Original lesson text and interactive nodes remain unchanged.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 659 files.
- A clean course archive was uploaded to a temporary production path and verified by SHA-256 before the atomic import and publish (`publish:200`), without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains seven v2 mappings and zero legacy SVG values for M22; representative image URLs return `200 image/png`.
