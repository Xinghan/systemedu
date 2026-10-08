# Homepage Engineering Flow Carousel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single homepage workflow diagram with a four-slide, single-theme engineering flow carousel that makes the SystemEdu journey readable in stages.

**Architecture:** Keep the homepage as a client component and use local React state for the active slide, timed rotation, hover/focus pause, previous/next controls, and indicator buttons. Store four deliberately minimal raster workflow illustrations in `public/landing/`; drive their accessible text and bilingual overlay copy from one typed slide array.

**Tech Stack:** Next.js 16, React 19, `next/image`, TypeScript, CSS-in-JS.

---

### Task 1: Produce the four diagram assets

**Files:**

- Create: `packages/student-web/public/landing/system-flow-raster-01-clone.webp`
- Create: `packages/student-web/public/landing/system-flow-raster-02-stages.webp`
- Create: `packages/student-web/public/landing/system-flow-raster-03-tutor.webp`
- Create: `packages/student-web/public/landing/system-flow-raster-04-finish.webp`

**Step 1:** Generate four individual, text-free engineering workflow diagrams sharing one visual system: warm white canvas, navy structural lines, coral selection, blue flow arrows, amber AI route, and green test signal.

**Step 2:** Inspect each output for a clear one-stage story, no narrative characters, no incorrect labels, and no generic milestone-only icons.

**Step 3:** Keep each compressed WebP focused on one theme only: clone, stages, AI assistance, or finished work.

### Task 2: Add typed carousel content and controls

**Files:**

- Modify: `packages/student-web/src/app/(home)/page.tsx:202-337`

**Step 1:** Replace the six-item `SYSTEM_FLOW_STEPS` content with a typed four-slide array containing bilingual stage number, title, body, image source, and alternative text.

**Step 2:** Add local state and a timed rotation effect. Pause rotation while the carousel contains hover or keyboard focus, respect `prefers-reduced-motion`, and reset the timer after a manual navigation.

**Step 3:** Replace the static image and six labels with one image, bilingual glass-panel copy over the lower-left of the image, previous/next controls, and four accessible selector buttons.

### Task 3: Add responsive presentation styling

**Files:**

- Modify: `packages/student-web/src/app/(home)/page.tsx:521-528`

**Step 1:** Add scoped carousel classes for the image frame, stage metadata, and controls, keeping the current landing page’s warm, restrained industrial visual language.

**Step 2:** On small screens, keep the image fully visible, compact the overlay copy without covering its main diagram, and retain 44px minimum touch targets.

### Task 4: Verify and retire superseded asset

**Files:**

- Delete: `packages/student-web/public/landing/system-flow-simple-01-clone.svg`
- Delete: `packages/student-web/public/landing/system-flow-simple-02-stages.svg`
- Delete: `packages/student-web/public/landing/system-flow-simple-03-tutor.svg`
- Delete: `packages/student-web/public/landing/system-flow-simple-04-finish.svg`

**Step 1:** Run `npx eslint 'src/app/(home)/page.tsx'` from `packages/student-web`.

**Step 2:** Run `git diff --check` on the homepage and verify no reference to the single-diagram asset remains.

**Step 3:** Open the carousel locally and confirm automatic and manual movement, keyboard controls, and small-screen layout.
