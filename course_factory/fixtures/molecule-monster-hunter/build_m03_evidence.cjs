const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),base=__dirname
const previous=JSON.parse(fs.readFileSync(path.join(base,'M03-spatial-v1.json'))),old=JSON.parse(fs.readFileSync(path.join(base,'M03-before-spatial-v1/slides.json'))).slides
const registry=JSON.parse(fs.readFileSync(path.join(base,'M03-spatial-v1.registry.json')))
const revised={
 0:['同一个分子：接续工具环境，分清连接与空间','上一节你保存了自己的运行环境记录；如果本机没有找到，这里会明确提醒，不拿示例冒充你的成果。现在看同一个甲烷：二维图方便读出谁和谁相连，三维模型方便检查被遮住的氢与四面体方向。拖动或切换视角，分子并没有变。公开计算坐标不是实验照片，也不是唯一构象。今天要把观察变成可复查的骨架报告。'],
 7:['观察四个分子，逐份保存自己的骨架记录','选择水、甲烷、乙醇或苯。旋转三维模型，定位原子，配合精确二维图核对连接。填写重原子、全部原子、全部连接和环数，再写一句自己的发现。全部计数都按含氢的完整分子口径，重原子另列。核对通过后保存当前分子，再做下一个。系统检查数字，不替你判定自由文字是否科学；模型观察记录也不冒充你已经运行过 Python。'],
 8:['运行完整模板，核对你自己的四条输出','现在从看图走到真实工具运行。下载完整脚本，在 M02 的 Python 环境运行，再粘贴得到的 JSON。模板明确导入 Chem，并先显式加氢，再计算原子数和连接数，同时记录环、芳香环和平均质量。网页比较四条固定输入的字段与参考口径，来源仍然标为本人提供，不会声称独立验证执行过程。环境不同会提醒复查，观察记录和运行输出分开保存。'],
 9:['带着自己的骨架报告，进入官能团比较','这里读取你实际保存在本机的四份结构观察和 Python 输出。没有完成就显示缺失；两类证据齐全后可以下载完整报告。M02 与本次解释器和版本不同，需要核对原因，但不会偷偷修改记录。右边比较乙烷和乙醇：两个碳的骨架旁，多了一个含氧官能团。下一节研究这种连接差异怎样影响相互作用。这是结构比较，不是反应，也不能直接得出药效结论。']
}
previous.slides.forEach((s,i)=>{s.payload.technical_visual.renderer='molecule-skeleton-evidence';s.audio_path=null;const p=old[i].payload||{};s.lesson_anchor=old[i].lesson_anchor||(p.theory_id?{kind:'theory',id:p.theory_id}:p.idea_id?{kind:'idea',id:p.idea_id}:undefined);if(revised[i])[s.title,s.audio_script]=revised[i]})
const out=JSON.stringify(previous,null,2)+'\n';fs.writeFileSync(path.join(base,'M03-spatial-evidence-v2.json'),out)
Object.assign(registry,{version:'spatial-evidence-v2',status:'integrated-awaiting-browser-qa',production_deployed:false,verified_draft_sha256:undefined,draft_sha256:crypto.createHash('sha256').update(out).digest('hex'),qa_record:'docs/slide-image-prompts/molecule-monster-hunter-M03-spatial-evidence-v2.md',preview_url:'http://127.0.0.1:4173/slide-preview/m03-evidence',media:{generated_raster:0,interactive_three_pages:[1,2,6,7,8],timed_state_pages:[7],exact_chemistry:'RDKit + KaTeX/mhchem',personal_evidence_pages:[8,9,10]}})
registry.slides.forEach((r,i)=>{r.teaching_claim=previous.slides[i].title;r.renderer='molecule-skeleton-evidence';r.lesson_anchor=previous.slides[i].lesson_anchor;r.decision_record=registry.qa_record;r.status='integrated-awaiting-browser-qa';if(i===7)r.relationship_and_behavior='四分子独立填数与观察句，校验后保存到本机；空白不通过，切换可恢复已保存记录';if(i===8)r.relationship_and_behavior='完整 Python 模板与本人输出逐字段校验；比较 M02 环境，明确输出来源未独立核验';if(i===9)r.relationship_and_behavior='实际读取完成状态；四份观察与 Python 输出都齐全才启用完整报告下载'})
fs.writeFileSync(path.join(base,'M03-spatial-evidence-v2.registry.json'),JSON.stringify(registry,null,2)+'\n')
console.log('M03 v2:',previous.slides.length,'slides; draft SHA',registry.draft_sha256)
