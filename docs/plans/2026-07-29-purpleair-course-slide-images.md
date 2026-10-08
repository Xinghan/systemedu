# PurpleAir Course Slide Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task by task.

**Goal:** Replace the instructional SVG illustrations in the complete PurpleAir course with coherent, generated PNG visuals; keep every visual asset traceable to its slide; publish each verified batch to production.

**Architecture:** `slides.json` remains the runtime source of truth. Each slide's `payload.images` lists its local visual files, stored in that same knode's `images/` directory. A prompt document records artistic intent before generation. The student web renders `payload.images` as the primary visual, including paging for slides with multiple images. The legacy `inline_svg` is removed only after the image asset, mapping, course manifest, and deployed page have passed verification.

**Tech Stack:** PNG assets from the image-generation workflow; course source at `/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node`; JSON slide payloads; `content_pipeline.manifest.regenerate_manifest`; `scripts/deploy-student.sh course purpleair-airquality-node`.

## Verified baseline

- Course source contains 54 lesson nodes and 569 slides.
- 428 slides currently contain an `inline_svg`; these form the first-pass replacement inventory. The remaining slides are videos, external learning resources, or already-specialized content and are not fabricated merely to inflate coverage.
- `M03-w0-pm2-5` is the production proof: 15 PNG assets are mapped to seven visual slides and serve as the style benchmark.
- The student renderer supports one-to-many `payload.images` with previous/next paging; images take precedence over the legacy SVG.

## Visual contract

- Use the established warm editorial science style: off-white background, coral/orange focus color, slate-blue secondary color, simple physical-science objects, and no embedded text that duplicates the slide copy.
- Create one primary image for every SVG-backed slide. Use two or three images only when a concept benefits from an explicit comparison, sequence, or process.
- Store each generated asset in `knodes/<node>/images/`, named `<slide_id>.<concept-slug>.img_<n>.png`.
- Add `{ "src": "images/<filename>.png", "caption": "…" }` entries to that slide's `payload.images`. This direct reference is the canonical image-to-slide relationship.
- Preserve `idea_id`, interactive-game data, and all teaching text. Images replace only the decorative SVG visual; they do not replace a game or an activity's behavior.
- Do not edit video and LabXchange slides unless they themselves have a legacy SVG that must be replaced.

## Delivery waves

| Wave | Nodes | Theme | Release gate |
| --- | --- | --- | --- |
| 0 | M03 | PM2.5 proof of concept | Already published and verified; finish its game cover during normal cleanup. |
| 1 | M01–M06 | Course orientation, air fundamentals, AQI | First production batch; establishes the recurring visual language. |
| 2 | M07–M17b | Raspberry Pi, coding, hardware, enclosure, node assembly | Publish after hardware images are technically legible. |
| 3 | M18–M27 | Sensors, physics, maths, NowCast, correction, dashboard | Review formulas and diagrams against the teaching copy before release. |
| 4 | M28–M34 | Automation, events, APIs, networks, reference data | Verify technical concepts and public-platform illustrations. |
| 5 | M35–M44 | Dataset quality, validation, uncertainty, calibration | Verify charts never imply fabricated learner data. |
| 6 | M45–M52 and M48b | Publication, DOI, reporting, community, final capstone | Final course-wide visual QA and completion report. |

## Task 1: Build and maintain the asset inventory

**Files:**
- Create: `docs/slide-image-prompts/purpleair-<node>.md`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node/knodes/<node>/slides.json`
- Create: `/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node/knodes/<node>/images/<slide_id>.<concept-slug>.img_<n>.png`

1. Read the node's titles, hero text, concept cards, theory bullets, and activity description.
2. Record one explicit prompt per new visual in the node prompt document, including the target `slide_id`, proposed filename, and Chinese caption.
3. Generate the image, inspect it, and place it in the node-local `images/` directory.
4. Add the exact relative filename and caption to `payload.images`.
5. Retain the SVG until this node passes the validation and production checks in Tasks 3–4; then remove only that slide's `inline_svg`.

## Task 2: Generate in small, reviewable node batches

1. Work sequentially through the delivery waves, beginning with M01 in this session.
2. Finish one node's prompt file, images, mappings, and local checks before moving to the next node.
3. Keep visual style consistent, but make each image explain the actual lesson rather than applying a generic course banner.
4. Treat any failed, misleading, or text-heavy generation as a rejected asset and regenerate it before mapping it.

## Task 3: Validate each batch before publishing

1. Parse every changed `slides.json` and confirm that each `payload.images[].src` exists under the same knode.
2. Verify that each target slide has a nonempty caption and no approved image path escapes its node directory.
3. Regenerate and validate the course manifest:

   ```bash
   .venv/bin/python -c "from pathlib import Path; from content_pipeline.manifest import regenerate_manifest; regenerate_manifest(Path('/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node'))"
   .venv/bin/python -c "from pathlib import Path; from library.manifest import load_manifest, verify_files; root=Path('/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node'); m=load_manifest(root / 'manifest.json'); print(verify_files(m, root))"
   ```

4. Confirm the student web still builds cleanly whenever the visual renderer changes; content-only batches do not need a web deployment.

## Task 4: Publish and prove the replacement

1. Upload only the finished course package:

   ```bash
   ./scripts/deploy-student.sh course purpleair-airquality-node
   ```

2. Run the production verification step:

   ```bash
   ./scripts/deploy-student.sh verify
   ```

3. Check the published course payload, sample image URLs, and at least one representative slide per changed node in the learner UI.
4. Record the wave, nodes, number of assets, and production result in the relevant prompt document before beginning the next wave.

## Completion criteria

- Every one of the 428 current SVG-backed PurpleAir slides has at least one production-served PNG visual or an explicit, documented exemption for a functional interactive slide.
- Every generated file has a direct `slides.json` mapping, a prompt record, and a valid course-manifest entry.
- Legacy SVGs have been removed from fully verified replacements; interactive behavior and slide narration continue to work.
- Each delivery wave is independently deployed and production-verified at `https://systeme.xin`.
