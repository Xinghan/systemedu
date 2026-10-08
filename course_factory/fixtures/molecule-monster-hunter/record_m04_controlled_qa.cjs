// Record completed, observed checks. This does not publish the M04 draft.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..'),read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const file=path.join(__dirname,'M04-controlled-v1.registry.json'),r=read(file),hash=sha(path.join(__dirname,'M04-controlled-v1.json'))
if(hash!==r.draft_sha256)throw Error('Repeat QA: draft changed')
for(const [f,h]of Object.entries(r.source_sha256))if(sha(path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter/knodes',r.node,f))!==h)throw Error('Unexpected M04 canonical change')
r.status='local-preview-verified-awaiting-review';r.verified_draft_sha256=hash;r.production_deployed=false;r.slides.forEach(s=>s.status=r.status)
r.qa={
 date:'2026-09-11',related_tests_passed:54,new_tests_passed:7,
 lint:'0 errors / 0 warnings in four new TypeScript files',
 typecheck:'20 pre-existing diagnostics outside the new M04 files; no new M04 diagnostics. Full workspace typecheck is not green.',
 browser:'Native Chrome CUA for three interactions and first visual pass; dedicated Codex in-app tab for DOM, responsive, record and floating verification',
 inline_widths:[480,720,960,1152],inline_page_checks:36,
 inline_geometry:'All nine actual slides at each requested width: horizontalOverflow=0 and no internal auto/scroll Y panels. Additional 906px capped checks excluded from the 36 count.',
 expanded_floating_pages:9,floating_geometry:'Actual page counter and heading verified for each page using the dialog previous/next controls; all nine have no horizontal overflow or internal scroll panels.',
 visual_review:'Nine wide native pages except record/handoff completed in in-app browser; representative narrow 3D page and dense record page reviewed. Generated phase picture displayed, labels and notation readable.',
 three:['PubChem ethanol object visibly rendered','oxygen O1 selected with C2/H9 neighbors','hydrogen visibility toggle changes display only','side camera changes occlusion','explicit RDKit 2D fallback works'],
 dynamic:'Real four-step playback reaches -1.0276; reset returns unrevealed state; one step reveals only CC 1.0262.',
 calculation:{browser_rdkit:'2025.03.4',CC:1.0262,CCO:-0.0014,CCCO:0.3887,CCN:-0.035,real_input_recalculation:true},
 record:['unconfirmed boundary blocked','empty conclusion blocked','explicit QA-only conclusion saved','download triggered','page 9 shows same saved values','refresh restores saved conclusion','two-click reset removed only the M04 QA record'],
 python:{rdkit:'2026.03.3',template_executed:true,CC:1.0262,CCO:-0.0014000000000000123,delta:-1.0276,measured:false},
 console:'In-app captured warning/error log list empty at final review.',
 image:{tool_mode:'built-in imagegen, generate',webp_bytes:39862,page:5,original_path:'/Users/xinghan/.codex/generated_images/019f64e5-f1b9-7430-ab89-463020bc7bdc/exec-947a30db-f91d-4722-ae66-4f97396dd199.png',limitations:'Illustrative phase/composition only; not a photo, measured sample, precise molecule, concentration or simulation.'},
 canonical_unchanged:true,new_audio:false,
 limitations:['Freehand pointer drag and forced WebGL context loss not independently retested; camera presets and 2D fallback verified.','Before deployment synchronize M04 lesson/theory/assignment/sections with the revised scientific boundary and rebuild a scoped release.','No new narration audio. No local preview writes were published.']
};save(file,r)
const pp=path.join(root,'docs/slide-image-prompts/molecule-monster-hunter-progress.json'),p=read(pp)
if(!p.last_production_batch.modules.includes('M03'))throw Error('Finalize M02/M03 production record first')
p.updated='2026-09-11';p.project_complete=false;p.current_batch={modules:['M04'],slides:9,production_deployed:false,status:r.status,generated_raster_images:1,interactive_3d_pages:[3],stepwise_playback_pages:[6],actual_computation_pages:[7],personal_evidence_pages:[8,9]};p.next_recommended_nodes=['M05']
Object.assign(p.entries.find(x=>x.module==='M04'),{status:r.status,production_deployed:false,draft:'course_factory/fixtures/molecule-monster-hunter/M04-controlled-v1.json',draft_sha256:hash,evidence:r.decision_record,preview:r.preview_url,note:'9 页本地新版：1 张 39,862-byte 生成图、Three.js 官能团定位、真实 RDKit 计算、逐步播放及可保存对照成果；54 测试通过，36 个宽度/页面检查及9页浮窗检查通过。未部署，新讲稿未配音。'})
save(pp,p);console.log('M04 local QA recorded; verified M02/M03 production state preserved.')
