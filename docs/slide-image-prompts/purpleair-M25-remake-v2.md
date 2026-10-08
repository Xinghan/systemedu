# PurpleAir M25 remake v2

Status: mapped and published to production after local review.

M25 turns the humidity-bias relationship into a fitted line, the Barkjohn correction, row-by-row corrected output and a visual verification check. Its eight dark inline SVG diagrams are replaced by raster illustrations in the locked course visual language: warm off-white cotton paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, flat paper-like metaphors, and ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, scenery, UI, labels and embedded text.

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M25-w0-module/images/remake-v2/`

| Slide | Candidate | Teaching relationship |
| --- | --- | --- |
| s1 | `s1.fit-line-to-corrected-values.v2.png` | A fitted line makes the upward point pattern usable for correction |
| s2 | `s2.vertical-residuals.v2.png` | Residuals are vertical gaps between observations and the fitted line |
| s3 | `s3.least-squares-shorter-residuals.v2.png` | The better line leaves shorter total residuals than a poorly placed line |
| s4 | `s4.many-observations-to-correction-rule.v2.png` | Many paired real observations become one reusable correction rule |
| s5 | `s5.correction-three-effects.v2.png` | Reduce raw bias, subtract humidity influence, then make a small baseline adjustment |
| s6 | `s6.apply-one-rule-each-row.v2.png` | Apply the same rule to every row to produce corrected data deterministically |
| s11 | `s11.verify-correction-before-after.v2.png` | Compare raw and corrected paths; hand-check inputs and preserve plausible values |
| s12 | `s12.corrected-data-to-repeatable-rule.v2.png` | Validated corrected data becomes a repeatable rule for the next coding lesson |

## Release record

- All eight slide `payload.images[].src` values point to the v2 candidates and the eight corresponding `inline_svg` values are removed. Animation, game, video and lab slides remain unchanged.
- The PurpleAir manifest was regenerated; the complete file preflight passed for all 683 files.
- A clean course archive was uploaded to a temporary production path and verified by SHA-256 before the atomic import and publish (`publish:200`), without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains eight v2 mappings and zero legacy SVG values for M25; representative image URLs return `200 image/png`.
