# Reused Transformer visualization engine

Upstream: https://github.com/bbycroft/llm-viz
Pinned commit: 9da93742382f1bf36c020c38a1ace454e82c4490
Retrieved: 2026-10-22. Copyright (c) 2023–2026 Brendan Bycroft. MIT.

This is an adapted dependency subset, not an original implementation of the renderer.
It retains the 3D WebGL renderer, picking, per-cell dependency visualization, individual algorithm walkthroughs, tensor utilities, and WASM inference integration. The trained minGPT A/B/C sorting model and upstream WASM are bundled under the same pinned source provenance.

Changes: original page/sidebar and homepage omitted; path aliases replaced by relative imports; asset paths scoped to /standalone/transformer-lab/model; canvas lifecycle extracted from LayerView with animation/context disposal; unused UI imports removed from MovementControls; original walkthrough CSS references replaced by empty maps because the English HTML commentary is not rendered. The numeric code remains upstream code. Walkthrough adaptation: preserve original animations but remove automatic pauses attached to the now-omitted English commentary; apply the last camera-transition target when seeking past it. The adapter schedules an additional frame after camera changes so paused seeking is rendered correctly.

The adapted TypeScript sources are authoritative. Run `node scripts/transformer-workshop/build-vendor.cjs` from the repository root to generate browser JavaScript under packages/student-web/src/lib/transformer-viz/vendor. This avoids applying the application’s React migration rules to legacy third-party internals; it does not hide compilation diagnostics in our adapter or learning UI.

The bridge and Chinese learning interface are separate application additions. Fonts retain their original licenses: Roboto (Copyright 2011 Google Inc., Apache 2.0), Computer Modern/BaKoMa (Copyright 1994, 1995 Basil K. Malyshev, BaKoMa Fonts Licence). See licenses/. Upstream’s combined glyph atlas is unchanged. The personal homepage, portrait and RISC-V assets are not included.

Validation: activate a Python 3.12 environment with NumPy 2.0.2, then run `node scripts/transformer-workshop/verify-model.cjs`. Set `MODEL_PYTHON` to an interpreter path if needed. The saved upstream WASM build script is archival and expects the upstream checkout layout; use the pinned upstream repository to rebuild native.wasm.
