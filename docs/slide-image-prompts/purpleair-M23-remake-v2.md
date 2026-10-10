# PurpleAir M23 remake v2

Status: mapped and published to production after local review.

M23 originally used eight dark inline SVG diagrams. Each is replaced by a raster illustration in the locked course visual language: warm off-white cotton paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, flat paper-like metaphors, and ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, scenery, UI, labels and embedded text.

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M23-w0-12h-nowcast/images/remake-v2/`

| Slide | Candidate | Teaching relationship |
| --- | --- | --- |
| s1 | `s1.hand-calculate-nowcast-table.v2.png` | Organize twelve readings before a paper-and-pencil NowCast calculation |
| s2 | `s2.four-known-components.v2.png` | Readings, dynamic weight, geometric weighting and result form the method |
| s3 | `s3.four-stage-hand-calculation-line.v2.png` | Set the weight, apply it, aggregate and map to AQI |
| s4 | `s4.range-to-weight-safety-stop.v2.png` | Relative variation sets a dynamic weight with a lower safety stop |
| s5 | `s5.weights-to-concentration-to-aqi.v2.png` | Decaying weights produce normalized concentration and an AQI band |
| s6 | `s6.check-weight-denominator-numerator.v2.png` | Verify weight, denominator and numerator in order before lookup |
| s11 | `s11.reproducible-hand-calc-notes.v2.png` | Reproducible hand-calculation notes support checking two examples |
| s12 | `s12.math-chain-closes.v2.png` | The 12-hour readings-to-AQI calculation chain closes as one loop |

## Release record

- All eight slide `payload.images[].src` values point to the v2 candidates and the eight corresponding `inline_svg` values are removed. Animation, game, video and lab slides remain unchanged.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 667 files.
- A clean course archive was uploaded to a temporary production path and verified by SHA-256 before the atomic import and publish (`publish:200`), without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains eight v2 mappings and zero legacy SVG values for M23; representative image URLs return `200 image/png`.
