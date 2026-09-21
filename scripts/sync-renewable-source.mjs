import fs from 'node:fs';import path from 'node:path'
const source=path.resolve(process.argv[2]||'../systemeduidea'),target=path.join(source,'project_lines/energy-motion'),pub=path.resolve('packages/student-web/public/project-lines/energy-motion')
if(!fs.existsSync(path.join(target,'line.json')))throw Error('Expected existing energy-motion source line')
const contract=JSON.parse(fs.readFileSync(path.join(target,'line.json'))),catalog=JSON.parse(fs.readFileSync('packages/student-web/src/lib/project-lines/renewable-courses.json'))
for(const c of catalog){
 const p=contract.projects.find(p=>p.id===c.id);if(!p)throw Error('Unknown planned project '+c.id)
 const root=path.join(target,'projects',c.id);fs.mkdirSync(root,{recursive:true});fs.cpSync(path.join(pub,c.id),root,{recursive:true});p.runtime={href:c.href,status:'local_ready',assessment:'software-checked; physical build and child timing unvalidated'};p.boundary='已制作本地课程与教学模型，不是器件性能承诺。学生结构件全部 3D 打印；只采购简单电子模块、电机和标准件。模板需按实购物品补充安装座、止挡与完整护网。实体方案尚未真实样机验证。'
 if(c.kind==='micro')continue
 const tree=JSON.parse(fs.readFileSync(path.join(root,'course/tree/knowledge_tree.json')));p.estimated_minutes=tree.estimated_minutes;p.curriculum={format:'multi-node-course',status:'local_ready',package_root:`project_lines/energy-motion/projects/${c.id}/course`,nodes:tree.modules.map(m=>{const resources=JSON.parse(fs.readFileSync(path.join(root,'course',m.resources)));return{id:m.module_id,title:m.title,estimated_minutes:m.estimated_minutes,depends_on:m.depends_on,objective:m.objective,video_brief:m.video_note||'原理视频配定向观察任务及中文替代阅读。',practice:m.objective,deliverable:m.output,learning_materials:[m.lesson,m.assignment],reference_topics:resources.filter(r=>r.kind==='reference').map(r=>r.title),acceptance:['保留本人具体条件与记录','区分模拟、实测与解释，提交本节点记录']}})}
 p.final_delivery={...p.final_delivery,title:tree.final_deliverable.title,how_to_check:tree.final_deliverable.acceptance.join('；'),review_location:c.href+'?node='+tree.final_deliverable.module_id+'#project-delivery'}
}
fs.cpSync(path.join(pub,'renewable-hardware'),path.join(target,'renewable-hardware'),{recursive:true})
fs.copyFileSync('scripts/generate-renewable-courses.mjs',path.join(target,'generate-courses.mjs'))
fs.writeFileSync(path.join(target,'line.json'),JSON.stringify(contract,null,2)+'\n')
fs.writeFileSync(path.join(target,'LOCAL-RELEASE.md'),'# 能源线本地课程版\n\n2026-09-21：9 个项目、29 个课程节点。课程包、生成封面与打印起点同步于此；交互运行时代码位于 systemedu 仓库。\n\n- 01：三个可直接操作的微体验。\n- 02：追光、风轮、储能、调度四门多节点课程。\n- 03：风光储整合、接口诊断、本人打印与实测。\n- 04：预先声明、固定首轮结果与事后修订。\n\n硬件包是尚未打印验证的教学起点，缺少的角码、安装座、完整护罩等由学生按实购物品设计。浏览器计算不代替物理样机验证。未进行儿童试用计时。\n\n生成脚本需在 systemedu 仓库根运行；同步此目录使用 scripts/sync-renewable-source.mjs。\n')
console.log(`Synced ${catalog.length} source project packages to ${target}`)
