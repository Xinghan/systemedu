# Energy Mission Journey Implementation Plan

**Goal:** Connect the existing renewable-energy and pvlib courses into an evidence-led off-grid observation station mission, with a complete map, operations center, station briefings and preserved classrooms.

**Architecture:** Reuse MissionControl, the operations record engine, room arrival effects, IntroFilm and the campus map. Add an energy-specific curriculum adapter and lesson wrappers. Keep original course IDs, learning scopes, artifacts and download routes unchanged. Task self-check, watching films, classroom submissions and physical verification remain separate.

**Tech Stack:** Next.js / React / TypeScript, existing learning-record API, generated WebP backgrounds, H.264/AAC mission films.

## Inventory and scope

Space and biomedicine have implemented mission hubs. Energy, robotics, environment, computing/AI and neuroscience lack mission hub routes. Energy is the next complete batch: it already has three renewable micro entries, six multi-node renewable courses and the 58-node pvlib course. Robotics, environment and neuroscience have classroom assets but need their own mission sequences and settings; computing/AI currently shares projects and needs a distinct final mission. Do not pretend those lines are implemented.

## Design

Eight stations: discovery; harvesting (solar + wind); storage/dispatch; system integration + challenge; measurement (pvlib M01–M20); forecasting (M21–M40); prospective validation (M41–M53); handover (M54–M58). Keep every pvlib module in its original pedagogical order. Earlier simulations establish methods; they cannot replace actual measurements, freeze-before-observation evidence or physical manufacture.

Physical structures use desktop 3D printing or printing services. Simple standard electronics, low-voltage modules and fasteners are allowed. No custom metal fabrication, mains-power work or mandatory thermal/flame engine. Historical drivetrain courses are optional support; the thermal course remains a separate catalog project.

User correction: all room backgrounds must be unmistakably INDOOR laboratories, no exterior windows, coastal views, landscapes, sunsets, people, or living-room decor. Differentiate stations by actual lab equipment and layout. Photorealistic unoccupied renewable research rooms: credible tabletop printed structures, real instruments, distinct compositions and restrained scientific overlays. Each short film explicitly shows actions and expected artifacts; no decorative-only slides. Backgrounds contain no people. Reuse static images where motion has no teaching value.

## Implementation sequence

1. Author energy mission mapping and source design under systemeduidea/project_lines/energy-motion/mission; generate web data with source provenance. Validate all links, station steps, prerequisites, outputs and stable IDs.
2. Add energy mission model, journey, dossier, briefing and control config, reusing current operations persistence. Add mission routes and context to guided/full/micro classroom surfaces.
3. Generate eight station environments and a campus map. Save responsive WebP variants and asset provenance. Author all station scripts and procedural film sequences; build MP4 and VTT assets.
4. Verify first arrival/replay/reduced motion, navigation through all stations, persistent records and dossier, mobile layout, full-course context, image/video loading and unchanged original classrooms. Run targeted lint/type baseline and production build.
5. Inspect only this batch, commit and push each repository's working branch, verify remote hashes. No deployment without a new request.

## Acceptance

Every task points to an existing source node or micro project; no stub lessons or new classroom tabs. Every non-micro station has explicit outputs and acceptance. Mission state and notes restore after reload and remain owner-scoped. Station films open on first arrival and remain replayable; viewing never completes tasks. Energy room images are unoccupied and distinct. Report implemented coverage and unresolved verification honestly.
