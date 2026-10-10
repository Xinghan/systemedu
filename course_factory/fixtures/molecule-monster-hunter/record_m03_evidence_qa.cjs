// Record observed local checks only. Never promote a preview to production.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../../..')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
const registryPath = path.join(__dirname, 'M03-spatial-evidence-v2.registry.json')
const registry = read(registryPath)
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'M03-spatial-evidence-v2.json'))).digest('hex')
if (hash !== registry.draft_sha256) throw new Error('Draft changed since registry creation; repeat QA before recording.')
registry.status = 'local-preview-verified-awaiting-review'
registry.verified_draft_sha256 = hash
registry.slides.forEach(slide => { slide.status = registry.status })
registry.qa = {
  date: '2026-09-10',
  new_tests_passed: 7,
  related_tests_total_passed: 47,
  eslint: 'passed on four new TypeScript/TSX files',
  diff_whitespace: 'passed',
  typecheck: '20 pre-existing diagnostics; none in new M03 files',
  browser: 'Chrome native UI via CUA',
  inline_wide_pages_reviewed: 10,
  expanded_floating_pages_reviewed: 10,
  narrow_width: 480,
  narrow_pages_reviewed: [1, 3, 8, 9, 10],
  automatic_dom_geometry_checks: false,
  layout_observation: 'No visible overlap in reviewed layouts; all ten expanded floating slides fit without internal scrolling.',
  real_three_pages_observed: [1, 2, 6, 7, 8],
  three_interactions: ['camera presets', 'hydrogen visibility versus unchanged totals', 'keyboard atom locator', 'explicit 2D fallback and restore'],
  timed_scan: 'single-step 0→1 and playback to 9 atoms; highlighter and counts synchronized',
  chemistry: 'RDKit 2025.03.4; methane angle 109.47 degrees; benzene plane deviation 0.0003 Å and C–C 1.395 Å',
  evidence: ['blank input blocked', 'four independent observations saved', 'switch restores saved values', 'unchecked origin blocked', 'wrong SMILES rejected', 'valid QA JSON accepted', 'complete report gated until four observations and run present', 'download observed', 'two-click reset cleared only M03 QA records'],
  browser_test_records: 'Explicit QA-only manually entered values, not actual learner Python execution. Cleared after validation.',
  template_fix: 'Benzene input now generated from registered MOLECULES, avoiding a mismatched alternative SMILES.',
  console: 'Final loaded page and 3D camera switch: no application errors observed; four extension/development info messages. DevTools reports 0 page errors and 2 non-breaking form id/name suggestions.',
  canonical_sources_unchanged: true,
  production_deployed: false,
  new_audio: false,
  limitations: ['Python template was not executed in a real Python RDKit environment this turn', 'WebGL context loss and freehand drag were not independently re-tested', 'Not a full all-width browser sweep', 'Before deployment synchronize original lesson/theory/assignment/section narratives and unlink obsolete audio; preview does not perform that release step']
}
write(registryPath, registry)

const m02Path = path.join(__dirname, 'M02-runtime-v1.registry.json')
const m02 = read(m02Path)
m02.qa.previous_remaining = m02.qa.previous_remaining || m02.qa.remaining
m02.qa.reviewed_inline_widths = [480, 720, 960, 1152]
m02.qa.intermediate_width_followup = '2026-09-10: all eight pages visually reviewed at both 720px and 960px; no visible horizontal overlap.'
m02.qa.console_followup = '2026-09-10: no application error in final console; extension/development information only. One non-breaking improvement suggestion.'
m02.qa.remaining = 'No pending intermediate-width or final console checks. Still a local preview; production release and new narration audio not performed.'
write(m02Path, m02)

const progressPath = path.join(root, 'docs/slide-image-prompts/molecule-monster-hunter-progress.json')
const progress = read(progressPath)
progress.updated = '2026-09-10'
progress.current_batch = {modules: ['M03'], slides: 10, production_deployed: false, status: registry.status, generated_raster_images: 0, interactive_3d_pages: 5, stepwise_playback_pages: [7], personal_evidence_pages: [8, 9, 10]}
progress.next_recommended_nodes = ['M04']
Object.assign(progress.entries.find(row => row.module === 'M03'), {status: registry.status, production_deployed: false, draft: 'course_factory/fixtures/molecule-monster-hunter/M03-spatial-evidence-v2.json', draft_sha256: hash, evidence: registry.qa_record, note: '10 页 v2 本地预览；5 页真实 Three.js、RDKit/KaTeX、逐原子播放、四分子个人观察及本人 Python 输出核对。47 项相关测试通过，10 页放大浮窗和代表性窄屏已检查；未部署、无新版配音。'})
progress.entries.find(row => row.module === 'M02').note = '8 页新版；实际 RDKit、动态执行、双环境故障练习、自报运行记录。480/720/960/1152px 与8页浮窗检查已完成；最终控制台未见应用错误。未部署、新讲稿无音频。'
write(progressPath, progress)
console.log('M03 v2 local QA and M02 follow-up recorded; production M01 history preserved.')
