# PurpleAir M24 remake v2

Status: mapped and published to production after local review.

M24 introduces paired humidity–reading-bias observations, scatter-plot correlation and hygroscopic growth. Its eight dark inline SVG diagrams are replaced by raster illustrations in the locked course visual language: warm off-white cotton paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, flat paper-like metaphors, and ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, scenery, UI, labels and embedded text.

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M24-w0-module/images/remake-v2/`

| Slide | Candidate | Teaching relationship |
| --- | --- | --- |
| s1 | `s1.humidity-bias-rising.v2.png` | Water-coated particle and a rising humidity–bias point pattern establish the new question |
| s2 | `s2.time-series-versus-paired-scatter.v2.png` | One quantity over time contrasts with two paired quantities in a scatter field |
| s3 | `s3.paired-observation-patterns.v2.png` | Upward, downward and directionless patterns; each observation pair remains joined |
| s4 | `s4.direction-tightness-outlier.v2.png` | Direction, tightness and a distant outlier are the three reading checks |
| s5 | `s5.hygroscopic-growth-scatters-more.v2.png` | Water grows the optical particle around an unchanged dry core, increasing scattering |
| s6 | `s6.physical-chain-meets-rising-scatter.v2.png` | The physical humidity-to-bias chain continues into the same upward trend shape |
| s11 | `s11.draw-read-share-scatter.v2.png` | Pair data, plot it by hand, read the pattern and make it legible to another viewer |
| s12 | `s12.correlation-to-correction-line.v2.png` | Seeing correlation leads into fitting a line and correcting high readings |

## Release record

- All eight slide `payload.images[].src` values point to the v2 candidates and the eight corresponding `inline_svg` values are removed. Animation, game, video and lab slides remain unchanged.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 675 files.
- A clean course archive was uploaded to a temporary production path and verified by SHA-256 before the atomic import and publish (`publish:200`), without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains eight v2 mappings and zero legacy SVG values for M24; representative image URLs return `200 image/png`.
