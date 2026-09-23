# ALOHA release verification

- Full course: 82 nodes, 11 stages, 826 slides; full source in systemeduidea/projects_data/aloha-bimanual-apprentice.
- course-check.json: real local library API, available project card, course detail, cover geometry, 1440/390 layouts, downloadable ZIP.
- diagram-check.json: 36 real slide-player checks; images load and canvas dimensions remain visible.
- canvas-check.json: 84 real slide-player checks across 1280/390 viewports after retaining authored canvas layout.
- release-renderer-check.json: isolated release checkout based on 58e7fef5; real TeacherSceneView, original M19 images and diagram, lesson HTTP fixture without a student account. Image requests assert the same Bearer header required by the protected course-file endpoint.
- Complete actual code tests and source/release hashes are archived with the course under audit/verification.

Reproduce the iframe checks with a temporary development route at packages/student-web/src/app/slide-preview/aloha-release-check/page.tsx. preview-current.tsx uses the shared workspace slide player; preview-release.tsx uses the isolated release renderer. Remove the temporary route afterward. Run the matching check-*.mjs from the repository root; the main local server is port 4000 and the isolated release check uses 4015.

Whole-site TypeScript checking is not reported as passing: the isolated base has four existing errors in unchanged course-content-view.tsx; current shared work also has two in slide-demo/page.tsx. No errors were reported for the new image component or changed slide renderer.

Software examples are synthetic. These checks do not establish physical robot safety/performance, a full GPU training result, or a child pilot. No production deployment was performed.
