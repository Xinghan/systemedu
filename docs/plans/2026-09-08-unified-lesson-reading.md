# Unified lesson reading and floating slideshow

> **Current release status (2026-09-09): deployed.** The corrected single-carousel reader, enlarged surface and floating slideshow are now on production build `vmjD0lyGWkm0wfjQ9HWyU`. See `docs/deployments/2026-09-09-lesson-reader.md`. The “No deployment” statements below describe the earlier preview milestones, not the current state.

## User correction — supersedes the inline-gallery design below

The default lesson must contain ONE paginated slide-and-audio component, followed by the course article. It must NOT interleave or flatten all slides through the article. The slideshow action opens the current page in a floating player. Only one player/audio element is mounted, and the current slide index survives opening/closing the window. Initial embedded narration does not autoplay; once the user starts playback it can continue on page changes. Existing lesson prose/activities stay intact.

Correction implementation: (1) share page state between embedded/floating modes, (2) remove all slide-slot insertions and replace them with one carousel, (3) verify one active slide, previous/next bounds, matched narration and float round-trip in the browser. No deployment.

### Correction verification — complete

- Default lesson and development preview each contain one carousel before the original article; no inline slide gallery remains.
- 40 tests pass, including selected-slide-only rendering, navigation bounds and one-player integration. Targeted component lint passes. Full TypeScript retains only the previously documented baseline errors.
- Browser verified one mounted player and zero inline slide cards. Opening the floating player preserves page 3; navigating to page 4 and closing returns to embedded page 4.
- M04 existing narration changes from 17.44 s on page 1 to 20.96 s on page 2. Embedded audio initially stays paused; floating playback works. Closing the window stops its audio and returns the same slide, paused from the start (audio timestamp is not preserved).
- Browser console has no errors. The existing visible preview is positioned at `#lesson-player`, showing slide 1/10, previous/next controls and the article below.
- No deployment. Historical implementation/verification below describes the superseded gallery and is retained only as history.

### Follow-up — enlarge slides and remove nested vertical scrolling

- Expand the player area to a maximum 1152px reading container while retaining the original 896px limit for prose.
- Embedded slides use natural content height rather than the old 76dvh cap; narration and pagination follow the complete slide. The lesson page itself still scrolls normally.
- Floating slides use a larger window and a ResizeObserver-fitted teaching surface, preserving the whole slide without an inner vertical scrollbar. This fitting may reduce text size in a small window; expanding the window provides more space.
- Verify content-height and fitted modes, single-slide pagination, dynamic scientific content resizing, and continued audio/page synchronization. No production deployment.
- Verification: all 42 related tests and targeted component ESLint pass. TypeScript still reports only the documented baseline errors. Browser measured inline surface height = scrollHeight (896px), zero internal vertical scrollers and one mounted player. In the floating window, the complete surface stays inside the viewport after selecting ethanol, maximizing and moving to page 2. Browser console has no errors. Left the expanded preview on page 1 for review; no deployment.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the course/teacher mode switch with one continuous lesson containing its teaching visuals and a separate floating slideshow with narration.

**Architecture:** Keep normalized slides in the existing course response, instead of fetching a second copy. Resolve explicit theory/activity/section anchors; never zip paragraphs and slides by ordinal position. Introduction, conclusion and genuinely unlinked supplemental visuals have explicit slots. Reuse SlideBody and the authenticated audio path in a bounded, accessible floating player. Preserve source prose, activities, anchors, outline, highlight/drill and version behavior. Keep warm application tokens. No production deployment or asset regeneration.

**Tech Stack:** Next.js / React, existing TypeScript course models, existing scientific renderers, HTML audio, node:test.

### Task 1 — Data and deterministic alignment
- Add optional slide source anchors and carry slides/knode directory in the gateway response.
- Implement and test explicit matching, aliases, missing/duplicate anchors and stable all-slide coverage.
- Restore reviewed source links for M03/M86 drafts without altering visual payloads or narration.

### Task 2 — Reading integration and floating playback
- Add a shared lesson-slide context and inline cards with launch-from-this-page actions.
- Retain all prose and original theory/activity content; avoid repeating identical linked activities.
- Replace two mode tabs with one slideshow action. Keep the article mounted while a non-modal window is open.
- Implement close, Escape, maximize/restore, page navigation, audio errors and cleanup. Stop section audio on opening and prevent overlap.
- Bound offscreen teaching renderers; keep exact text accessible while visual surfaces load.

### Task 3 — Verification and local preview
- Add a development-only real-course preview and allowlisted existing audio example; do not synthesize speech.
- Run mapping tests, existing science tests, targeted lint and TypeScript comparison against known baseline issues.
- Browser-check inline visual locations, open-from-page, navigation, audio/missing audio, close, reading position and responsive layout.
- Record outcome here and show the local preview to the user. No deployment.

## Execution notes

- Existing worktree contains extensive unrelated and previous slide work. Changes must be additive and scoped; no branch resets or blanket formatting.
- The finishing-a-development-branch skill referenced by executing-plans is not installed. Use existing Code verification guidance and deliver local changes without making commits or deployments.

## Verification — local implementation complete

- Course adapter retains normalized slides in the same response as prose; no second deck fetch in the unified reading path.
- Explicit theory/activity/section mapping, topic aliases and safe supplemental fallback implemented. Source-preserving tokenizer ignores fenced marker examples, and repeated markers render the linked surface only once.
- M03/M86 draft source associations restored; visual payloads, narration and original course files remain unchanged. M03's two unlinked summary/overview slides remain explicitly supplemental rather than guessed into paragraphs.
- 36 tests pass across lesson layout and the existing skeleton/funnel, screening and tendon-torque suites. Targeted ESLint passes for new components, shared player, helper and preview routes.
- Full TypeScript still reports the existing slide-demo, assignment, capstone API and five course-content-view errors. No new errors in changed functionality. Full course-content lint also retains the old Date.now/effect warnings/errors; those unrelated behaviors were not rewritten.
- Browser: M03 page 3 launch opens index 2; next opens index 3; expand/restore and Escape work. Reading scroll was 2248.5 before and after closing. The inline water selection remained selected after opening/closing the player.
- Browser: M04 page 1 audio actually played (17.44 s duration, readyState 4, currentTime advancing); page 2 used its own 20.96 s narration, one audio element only. Closing removed audio and dialog.
- Browser: intentional dev-only missing audio returned a clear error with retry; slide remained visible, loading did not persist.
- 390px iframe viewport visually checked: header, action, article cards and 3D stack fit the narrow layout. Full touch-device interaction was not simulated.
- Preview: `/slide-preview/lesson-reading`. Existing M04 assets are used solely to test narration; M03 uses reviewed new visuals without fabricated audio. Preview and its allowlisted audio route return 404 outside development.
- No production writes, uploads, deployments, speech synthesis or image generation performed. Ready for user review.
