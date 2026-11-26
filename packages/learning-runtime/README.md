# Shared learning runtime

Original Blender / Three.js experiments and the guided course Markdown renderer shared by the website and the iOS app. `student-web` imports the same source via its local package dependency. The standalone entry is bundled for WKWebView without Next.js, remote JavaScript, or a web server.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
```

`dist/` is generated and ignored. Asset copies come from `student-web/public`, with hashes in `asset-provenance.json`. Source `.blend` files are not copied. All production dependencies are pinned; install this package before building `student-web` on a fresh checkout. The runtime's own React dependencies are required for its independent bundler; Next resolves the shared source during the website build.

The host adapter supplies native SQLite persistence or explicit browser-preview local storage. It never receives a JWT and does not submit to the existing learning-record API. The bridge methods are `load`, `save`, `export`, and optional mission-only `advance`; server synchronization is a later stage. The reader awaits a successful completion save before requesting `advance`. The native mission checks the current activity and persisted completion (including required photo evidence), and accepts only one successful advance per WebView. Ordinary course readers complete in place.
