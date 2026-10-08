# PurpleAir M15–M16 remake v2

Status: mapped and published to production after local review.

## Locked visual system

- Hand-painted educational editorial watercolor on warm off-white cotton paper.
- Predominantly muted coral orange and slate blue, with only a restrained sunflower-yellow accent.
- Spacious compositions, soft paper grain and modest painted shadows.
- Hardware and physical cause-and-effect take priority over decorative scenes.

Do not introduce deep-violet full-bleed backgrounds, glossy or clay-like 3D rendering, neon/glow effects, floating orbs, flowers, futurist UI, labels, fake dashboards, or readable text.

## Candidate inventory

### M15 — redundant sensors

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M15-w0-pms7003-mq-135/images/remake-v2/`

| Slide | Candidate | Teaching focus |
| --- | --- | --- |
| s1 | `s1.dual-pm-crosscheck.v2.png` | Two matching PM sensors cross-check closely aligned paths. |
| s2 | `s2.single-versus-paired-sensors.v2.png` | A single sensing path versus paired paths that expose drift. |
| s3 | `s3.backup-and-crosscheck.v2.png` | Backup sensing and agreement/discrepancy comparison. |
| s6 | `s6.three-sensor-kit.v2.png` | Pi, dual PM sensors, gas sensor and ADC arranged as a kit. |
| s9 | `s9.three-sensor-workflow.v2.png` | Add sensors, compare streams and record the result. |
| s10 | `s10.reliable-node-online.v2.png` | Calm completed multi-sensor node. |

### M16 — weatherproof enclosure

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M16-w0-module/images/remake-v2/`

| Slide | Candidate | Teaching focus |
| --- | --- | --- |
| s1 | `s1.breathing-rainproof-box.v2.png` | Air enters the baffled enclosure while rain falls past. |
| s2 | `s2.sealed-versus-flooded-box.v2.png` | Sealed, balanced and overly open enclosure trade-off. |
| s3 | `s3.air-turns-rain-falls.v2.png` | The baffle forces air to turn while rain continues down. |
| s6 | `s6.weatherproof-test-kit.v2.png` | Enclosure, fan, spray bottle and particle card test kit. |
| s9 | `s9.good-site-versus-microclimates.v2.png` | Shaded open mounting versus exhaust, sun and wall-corner microclimates. |
| s10 | `s10.enclosure-test-workflow.v2.png` | Assemble, load, fan-test, spray-test and mount workflow. |
| s11 | `s11.window-ready-node.v2.png` | Window-side finished node in gentle rain. |

## Release record

- The 13 `payload.images[].src` values now point to their matching `remake-v2` candidates.
- The course manifest was regenerated and its full file verifier returned no missing or mismatched files.
- `./scripts/deploy-student.sh course purpleair-airquality-node` published the updated course without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production library database contains all six M15 and seven M16 replacement paths; representative image URLs return `200 image/png`.
- Original image assets remain untouched for rollback.
