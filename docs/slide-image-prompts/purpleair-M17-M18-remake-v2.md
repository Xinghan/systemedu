# PurpleAir M17–M18 remake v2

Status: mapped and published to production after local review.

Art direction is locked to the M04–M14 baseline: warm off-white paper, hand-painted editorial watercolor, muted coral orange and slate blue, restrained yellow, ample empty space. Reject deep-violet backgrounds, 3D/clay or gloss, neon/glow, flowers, UI, labels and embedded text.

## M17 — node identity and GPS (complete)

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M17-w0-gps/images/remake-v2/`

| Slide | Candidate |
| --- | --- |
| s1 | `s1.device-becomes-map-point.v2.png` |
| s2 | `s2.anonymous-node-problem.v2.png` |
| s3 | `s3.globe-coordinate-lock.v2.png` |
| s6 | `s6.installation-identity-kit.v2.png` |
| s9 | `s9.install-name-locate-document.v2.png` |
| s10 | `s10.location-record-reasoning.v2.png` |
| s11 | `s11.verified-map-point.v2.png` |

## M18 — laser scattering (complete)

Candidate directory: `projects_data/purpleair-airquality-node/knodes/M18-w0-pms5003/images/remake-v2/`

| Slide | Candidate |
| --- | --- |
| s1 | `s1.laser-counts-particles.v2.png` |
| s2 | `s2.dust-in-light-beam.v2.png` |
| s3 | `s3.airflow-laser-detector-chain.v2.png` |
| s4 | `s4.scattering-sweet-spot.v2.png` |
| s7 | `s7.sensor-light-path-cutaway.v2.png` |
| s9 | `s9.draw-the-principle-workflow.v2.png` |
| s10 | `s10.opened-sensor-black-box.v2.png` |

## Release record

- All fourteen `payload.images[].src` values now point to the matching `remake-v2` candidates.
- The PurpleAir manifest was regenerated; the complete file verifier returned no missing or mismatched files.
- The single-course import and publish completed successfully (`publish:200`) without restarting the library service.
- Production checks passed for backend health, web, library reverse proxy, HTTPS nginx and admin page. The production database contains seven v2 mappings for M17 and seven for M18; representative image URLs return `200 image/png`.
- Original images remain untouched as rollback material.
