"use client"
import { useState } from 'react'
import { Check, Circle, Package } from 'lucide-react'
import type { GuidedCourse, GuidedModule } from '@/lib/project-lines/guided-course'
import type { LearningBody, LearningScope } from '@/lib/api/learning-records'
import { learningRecords } from '@/lib/api/learning-records'
import { learningCacheKey } from '@/lib/learning-record-session'
import { useLearningRecord } from '@/lib/hooks/use-learning-record'
import { BIOMED_DATA, DATA_VERSION, PROJECT_KINDS, LAST_NODE, METHODS, DEFAULT_CONFIG, newWorkspace, validWorkspace, validRegistration, deliveryChecks, configKey, evaluate, runWorkspace, register, reveal, pool, probeEvidence, type Config, type Result, type Workspace, type ProjectKind, type Mode } from '@/lib/project-lines/biomed-model'
import { LearningRecordStatus, downloadLearningRecord } from './learning-record-status'
import { BiomedUnderstandingCheck } from './biomed-understanding-check'
import { BiomedArtifactReport } from './biomed-artifact-report'
import styles from './biomed-workspace.module.css'

export const biomedScope=(id:string,final=false):LearningScope=>({library_slug:id,module_id:final?LAST_NODE[PROJECT_KINDS[id]]:'WORK',activity_id:final?'final-deliverable':'molecular-workbench',kind:final?'assignment':'classroom',content_version:'1.0'})
const initial:LearningBody={answers:[],artifact:newWorkspace() as unknown as Record<string,unknown>}
const asArtifact=(a:Workspace)=>a as unknown as Record<string,unknown>
const FMT=(n:number|null)=>n===null?'—':n.toFixed(3)
function Checks({kind,a}:{kind:ProjectKind;a:Workspace}){return <ul className={styles.checks}>{deliveryChecks(kind,a).map(c=><li key={c.title} data-passed={c.passed}>{c.passed?<Check size={16}/>:<Circle size={16}/>}<span>{c.title}</span></li>)}</ul>}
function Configuration({config,onChange,filter=false,predictor=false,system=false}:{config:Config;onChange:(c:Config)=>void;filter?:boolean;predictor?:boolean;system?:boolean}){
  const set=<K extends keyof Config>(k:K,v:Config[K])=>onChange({...config,[k]:v})
  return <div className={styles.twoCols}>
    {filter&&<><label className={styles.field}>分子量上限：{config.maxMass} g/mol<input aria-label="分子量上限" type="range" min="100" max="650" step="25" value={config.maxMass} onChange={e=>set('maxMass',Number(e.target.value))}/><small>条件是小于等于上限；不是药效标准。</small></label><label className={styles.field}>计算 logP 上限：{config.maxLogP}<input aria-label="logP 上限" type="range" min="0" max="7" step=".5" value={config.maxLogP} onChange={e=>set('maxLogP',Number(e.target.value))}/><small>模型估计的分配倾向，和实测水溶解度不是同一列。</small></label><label className={styles.field}>遇到缺失值<select aria-label="遇到缺失值" value={config.missing} onChange={e=>set('missing',e.target.value as Config['missing'])}><option value="hold">暂存，等待核查</option><option value="allow">先放行（实验比较用）</option></select></label></>}
    {predictor&&<><label className={styles.field}>预测方法<select aria-label="预测方法" value={config.method} onChange={e=>set('method',e.target.value as Config['method'])}>{Object.entries(METHODS).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label className={styles.field}>用什么描述相似性<select aria-label="用什么描述相似性" disabled={config.method==='mean'} value={config.features} onChange={e=>set('features',e.target.value as Config['features'])}><option value="mass">只比较分子量</option><option value="three">分子量 + logP + 极性表面积</option></select><small>近邻特征用训练集标准差缩放；平均值方法不使用特征。</small></label></>}
    {system&&<><label className={styles.field}>复核预算：{config.budget} 点<input aria-label="复核预算" type="range" min="4" max="24" step="1" value={config.budget} onChange={e=>set('budget',Number(e.target.value))}/><small>教学成本 = 1 + 环数的一半向上取整，不是真实实验报价。</small></label><label className={styles.field}>预测 logS 下限：{config.minPrediction}<input aria-label="预测门槛" type="range" min="-8" max="0" step=".5" value={config.minPrediction} onChange={e=>set('minPrediction',Number(e.target.value))}/><small>保留预测大于等于下限的分子；越严格，候选可能越少。</small></label><label className={styles.field}>复核顺序<select aria-label="复核顺序" value={config.ranking} onChange={e=>set('ranking',e.target.value as Config['ranking'])}><option value="solubility">优先较高预测溶解度</option><option value="variety">兼顾不同环数</option></select><small>第二种方法给尚未覆盖的环数类别加 1 分；只是一种可检验的教学排序。</small></label></>}
  </div>
}
function ResultView({result,selected='',onSelect}:{result:Result;selected?:string;onSelect?:(id:string)=>void}){
  const points=result.rows.filter(r=>r.prediction!==null&&r.measured!==null)
  const values=points.flatMap(r=>[r.prediction!,r.measured!]),lo=Math.min(-1,Math.floor(Math.min(...values))),hi=Math.max(0,Math.ceil(Math.max(...values))),range=hi-lo||1
  const x=(v:number)=>64+(v-lo)/range*420,y=(v:number)=>292-(v-lo)/range*242
  return <div data-biomed-result><div className={styles.stats}>{result.mae!==null&&<div><strong>{FMT(result.mae)}</strong><small>平均绝对误差 · logS 单位</small></div>}<div><strong>{result.selected}</strong><small>当前选中 / 共 {result.rows.length} 条</small></div>{result.spent>0&&<><div><strong>{result.spent} / {result.budget}</strong><small>已用复核预算</small></div><div><strong>{result.coverage}</strong><small>覆盖的环数类别</small></div></>}</div>
    {points.length>0&&<><svg viewBox="0 0 550 345" className={styles.plot} role="img" aria-label="预测与测量对比散点图，点越接近对角线误差越小，完整数值在下方表格"><title>横轴测量 logS，纵轴预测 logS；对角线表示两者相等</title>{Array.from({length:5},(_,i)=>lo+range*i/4).map(v=><g key={v}><path d={`M ${x(v)} 45 V 292 M 64 ${y(v)} H 484`} stroke="#e2e6dc"/><text x={x(v)} y="311" fill="#758273" fontSize="11" textAnchor="middle">{v.toFixed(1)}</text><text x="54" y={y(v)+4} fill="#758273" fontSize="11" textAnchor="end">{v.toFixed(1)}</text></g>)}<line x1="64" y1="292" x2="484" y2="50" stroke="#acb4a4" strokeDasharray="5 5"/>{points.map(r=><g key={r.id}><line x1={x(r.measured!)} y1={y(r.measured!)} x2={x(r.measured!)} y2={y(r.prediction!)} stroke={r.id===selected?'#c47853':'#d9cdb5'} strokeWidth={r.id===selected?2:1}/><circle cx={x(r.measured!)} cy={y(r.prediction!)} r={r.id===selected?7:4.5} fill={r.id===selected?'#c47853':'#42766a'}><title>{r.id}：预测 {r.prediction}，测量 {r.measured}，绝对误差 {r.error}</title></circle></g>)}<text x="274" y="333" fontSize="12" textAnchor="middle" fill="#526f64">实测 logS / log10(mol/L)</text><text x="20" y="24" fontSize="12" fill="#526f64">预测 logS</text></svg><p className={styles.caption}>点到对角线的竖向距离是该样本的绝对误差。MAE 对本次全部样本计算，不因筛选排除而隐藏困难样本。</p></>}
    <details className={styles.history} open={points.length===0}><summary>逐条检查数据与原因 · {result.rows.length} 条</summary><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>样本</th><th>MW g/mol</th><th>计算 logP</th>{points.length>0&&<><th>预测</th><th>测量</th><th>绝对误差</th></>}<th>处理结果</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.id} data-selected={r.id===selected}><td>{onSelect&&r.error!==null?<button type="button" onClick={()=>onSelect(r.id)}>{r.id}</button>:r.id}<br/><small>{r.name}</small></td><td>{FMT(r.mass)}</td><td>{FMT(BIOMED_DATA.molecules.find(m=>m.id===r.id)?.logp??null)}</td>{points.length>0&&<><td>{FMT(r.prediction)}</td><td>{FMT(r.measured)}</td><td>{FMT(r.error)}</td></>}<td>{r.reason}{r.id!==r.sourceId&&<small> · 关联预测 {r.sourceId}</small>}</td></tr>)}</tbody></table></div></details>
  </div>
}
function Delivery({course,a,ready}:{course:GuidedCourse;a:Workspace;ready:boolean}){
  const kind=PROJECT_KINDS[course.id],record=useLearningRecord(biomedScope(course.id,true),{answers:[]})
  const complete=ready&&validWorkspace(a)&&deliveryChecks(kind,a).every(c=>c.passed)
  const body:LearningBody={artifact:asArtifact(a),answers:[{question_id:'reason',question:'我的选择理由',answer:a.reason},{question_id:'limitation',question:'适用范围与局限',answer:a.limitation},...(kind==='challenge'?[{question_id:'conclusion',question:'对预先标准的判断',answer:a.conclusion}]:[])],client_context:{schema:'biomed-delivery/1',assessment:'ungraded',data_version:DATA_VERSION}}
  const submitted=!!record.submittedAt&&JSON.stringify(record.body)===JSON.stringify(body)
  const saved=record.history.length?record.history:record.submittedAt?[{id:'local',created_at:record.submittedAt,body:record.body}]:[]
  async function submit(){if(record.pending){await record.session.submit();return}if(!complete)return;record.session.update(structuredClone(body));await record.session.submit()}
  return <section id="project-delivery" className={styles.delivery} data-biomed-delivery><p className={styles.eyebrow}><Package size={16} style={{display:'inline',marginRight:8}}/>最终作品 / 证据与解释</p><h3>{course.final_deliverable?.title}</h3><Checks kind={kind} a={a}/><p>这里核对作品和可复算的实验材料。你的解释提交后仍待评阅；误差较大或假设不成立，不会使一份诚实的研究记录失去价值。</p><button type="button" className={styles.primary} disabled={!record.ready||record.busy||record.conflict||(!record.pending&&(!complete||submitted))} onClick={submit}>{record.pending?'重试上次交付':submitted?'作品已保存 · 待评阅':record.identity.token?'提交我的最终作品':'保存最终作品到本机'}</button><LearningRecordStatus record={record}/>{saved.map(s=><details className={styles.snapshot} key={s.id} data-biomed-submission><summary>查看已交付作品 · {new Date(s.created_at).toLocaleString()}</summary>{validWorkspace(s.body.artifact)&&<><BiomedArtifactReport kind={kind} artifact={s.body.artifact}/><details className={styles.history}><summary>技术附录：原始数据快照</summary><pre>{JSON.stringify(s.body.artifact,null,2)}</pre></details><button type="button" className={styles.button} onClick={()=>downloadLearningRecord(s.body,`${course.id}-submission.json`)}>导出这份作品副本</button></>}</details>)}</section>
}
function ChallengeControls({a,stage,locked,update}:{a:Workspace;stage:number;locked:boolean;update:(a:Workspace)=>void}){
  const saved=useLearningRecord({library_slug:'challenge-an-unseen-library',module_id:'M02',activity_id:'pre-registration',kind:'assignment',content_version:'1.0'},{answers:[{question_id:'question',question:'我的研究问题',answer:''},{question_id:'criterion',question:'预先声明的 MAE 上限',answer:'1.5'},{question_id:'rationale',question:'选择这个标准的理由',answer:''}]})
  const registration=validRegistration(saved.body.artifact)&&saved.submittedAt?saved.body.artifact:null
  const get=(id:string)=>saved.body.answers.find(x=>x.question_id===id)?.answer||''
  const set=(id:string,value:string)=>saved.session.update({...saved.body,answers:saved.body.answers.map(x=>x.question_id===id?{...x,answer:value}:x)})
  const criterion=Number(get('criterion')),canRegister=!!get('question').trim()&&!!get('rationale').trim()&&Number.isFinite(criterion)&&criterion>=.1&&criterion<=5&&a.runs.some(r=>r.mode==='validation'&&r.key===configKey(a.config))
  async function seal(){if(saved.pending){await saved.session.submit();return}if(!canRegister)return;saved.session.update({...saved.body,artifact:register(a.config,get('question'),criterion,get('rationale')) as unknown as Record<string,unknown>});await saved.session.submit()}
  return <div>{stage<=2&&!registration?<><p>先在验证集上试好方法，再把问题、容许误差和理由锁进方案。这个课堂工具不会自动替你写研究问题。</p><fieldset disabled={locked||!saved.ready||saved.busy||saved.conflict||saved.pending}><label className={styles.field}>我想检验的问题<input maxLength={400} value={get('question')} placeholder="例如：只凭分子量找近邻，在不同骨架分子上还可靠吗？请写自己的问题。" onChange={e=>set('question',e.target.value)}/></label><div className={styles.twoCols}><label className={styles.field}>预先声明：MAE 不超过<input aria-label="预先声明：MAE 不超过" type="number" min=".1" max="5" step=".1" value={get('criterion')} onChange={e=>set('criterion',e.target.value)}/><small>单位 logS；这是你要检验的标准，未达到也可交付。</small></label><label className={styles.field}>为什么选择这个标准<input maxLength={500} value={get('rationale')} placeholder="结合验证误差和用途解释，不必承诺成功。" onChange={e=>set('rationale',e.target.value)}/></label></div></fieldset><button type="button" className={styles.primary} disabled={locked||!saved.ready||saved.busy||saved.conflict||(!saved.pending&&!canRegister)} onClick={seal}>{saved.pending?'重试冻结方案':'冻结并保存我的方案'}</button><LearningRecordStatus record={saved}/></>:registration?<div className={styles.seal}><h4>已冻结的第一次方案</h4><p>{registration.question}</p><p>{METHODS[registration.config.method]} · {registration.config.features==='mass'?'只用分子量':'三种结构属性'} · MAE ≤ {registration.criterion}</p><small>16 条预测已随方案保存。揭晓后第一次结果会保留，后续改进另列为探索。</small>{stage>=3&&!a.firstBlind&&<div className={styles.actions}><button type="button" disabled={locked} onClick={()=>update(reveal(a,registration))}>揭开新数据并核对第一次预测</button></div>}</div>:<p className={styles.notice}>尚无已保存的冻结方案。请回到 M02 完成并保存，再打开新数据。</p>}
    {a.firstBlind&&a.registration&&<div className={styles.errorCase}><strong>第一次结果：MAE {FMT(a.firstBlind.result.mae)}</strong><p>预先标准 ≤ {a.registration.criterion} · {a.firstBlind.result.mae!<=a.registration.criterion?'本批数据达到自己的标准':'本批数据没有达到自己的标准'}。保留原结果，再解释发生了什么。</p><details><summary>打开第一次结果（固定快照）</summary><ResultView result={a.firstBlind.result}/></details></div>}
    <p className={styles.muted}>新数据来自同一公开数据源，事前在页面内隐藏答案。它用于练习研究顺序，不是保密考试；换账号或直接查公开数据不能算独立检验。</p>
  </div>
}

export function BiomedProjectWorkspace({course,node}:{course:GuidedCourse;node:GuidedModule}){
  const kind=PROJECT_KINDS[course.id],record=useLearningRecord(biomedScope(course.id),initial)
  const valid=validWorkspace(record.body.artifact),a=valid?record.body.artifact as unknown as Workspace:newWorkspace()
  const stage=Number(node.module_id.slice(1)),last=LAST_NODE[kind]===node.module_id
  const [message,setMessage]=useState(''),[importing,setImporting]=useState(false)
  const locked=!record.ready||record.pending||record.conflict||importing||(!valid&&record.ready)
  const update=(next:Workspace)=>{if(!locked)record.session.update({answers:[],artifact:asArtifact(next)})}
  const change=(config:Config)=>update({...a,config})
  const run=(mode:Mode)=>{update(runWorkspace(a,mode));setMessage('本次配置与逐条结果已加入实验记录。修改配置后，请重新运行。')}
  const recent=a.runs.at(-1),same=recent?.key===configKey(a.config)
  const selectedResult=kind==='challenge'&&a.firstBlind?a.firstBlind.result:recent?.result
  const error=selectedResult?.rows.find(r=>r.id===a.selectedError)
  async function importSources(){
    setImporting(true)
    try{
      const found=[]
      for(const id of ['build-a-candidate-filter','check-a-prediction']){
        const scope=biomedScope(id,true)
        let body:LearningBody|undefined,submissionId='local-submission'
        if(record.identity.token){const remote=await learningRecords.read(record.identity.token,scope);body=remote.submissions[0]?.body;submissionId=remote.submissions[0]?.id||''}
        else{const raw=localStorage.getItem(learningCacheKey(record.identity.owner,scope));if(raw){const cache=JSON.parse(raw);if(cache.submittedAt){body=cache.body;submissionId=cache.submittedAt}}}
        if(body&&validWorkspace(body.artifact)&&deliveryChecks(PROJECT_KINDS[id],body.artifact).every(c=>c.passed))found.push({project:id,submissionId,config:body.artifact.config})
      }
      if(!found.length){setMessage('还没有可导入的正式作品。可以直接在本课制作：至少修改一套筛选/预测配置、比较两次运行并完成诊断。');return}
      let config={...a.config}
      for(const f of found){if(f.project==='build-a-candidate-filter')config={...config,maxMass:f.config.maxMass,maxLogP:f.config.maxLogP,missing:f.config.missing};else config={...config,method:f.config.method,features:f.config.features}}
      record.session.update({answers:[],artifact:asArtifact({...a,config,sources:found})});setMessage(`已读取 ${found.length} 份自己的正式作品；参数已接入，仍需对组合后的系统测试。`)
    }catch{setMessage('作品暂时未能读取，未替换当前配置。可以重试。')}finally{setImporting(false)}
  }
  return <><section className={styles.workspace} data-biomed-workspace={kind}>
    <p className={styles.eyebrow}>{kind==='filter'?'候选筛选台':kind==='prediction'?'预测检验台':kind==='desk'?'我的发现工作台':'新数据研究室'} / {node.module_id}</p><h3>{node.output}</h3>
    {!valid&&record.ready&&<p className={styles.notice}>这份旧草稿格式无法核验，原数据未覆盖。请先从记录选项导出备份。</p>}
    <fieldset disabled={locked}>
    {stage===1&&<><div className={styles.diagram}>{[['48','训练样本'],['16','验证样本'],['16','04 级新数据'],['logS','水溶解度目标']].map(([n,t])=><div key={n+t}><small>{t}</small><strong>{n}</strong></div>)}</div><p>当前版本 {DATA_VERSION}。分子量、logP 和极性表面积由结构计算；目标列来自 ESOL 公开的实测水溶解度。01 级的三种分子用于结构观察，不混入这里的模型训练。</p><a href="/project-lines/biomedicine/data/source.json" target="_blank" rel="noreferrer">查看数据来源、单位和划分方法</a>{kind==='filter'&&<ResultView result={evaluate(DEFAULT_CONFIG,'filter')}/>}</>}
    {kind==='desk'&&stage===1&&<><div className={styles.actions}><button type="button" onClick={importSources}>接入我在 02 级交付的作品</button></div><p>{a.sources.length?`已接入 ${a.sources.length} 个作品：${a.sources.map(s=>s.project==='build-a-candidate-filter'?'筛选条件':'预测方法').join('、')}。`:'也可从本课开始制作，不要求先学完两条支线。平台提供起始参数，你需要修改、比较并解释自己的版本。'}</p></>}
    {kind==='desk'&&<div className={styles.diagram}>{['读取属性','应用筛选','关联预测','分配复核预算'].map((t,i)=><div key={t}><small>0{i+1}</small><strong>{t}</strong></div>)}</div>}
    {(kind==='filter'&&stage>=2||kind==='prediction'&&stage>=2||kind==='desk'&&stage!==3||kind==='challenge'&&(stage===1||stage===4))&&<Configuration config={a.config} onChange={change} filter={kind==='filter'||kind==='desk'} predictor={kind!=='filter'} system={kind==='desk'}/>}
    {kind==='desk'&&stage===3&&<><p className={styles.notice}>候选数量看起来正常，但一部分预测可能挂错了样本。先记录假设，再选择检查；平台不会因为你猜中选项而省略证据。</p><label className={styles.field}>我先怀疑什么<input value={a.hypothesis} maxLength={500} placeholder="例如：是单位变化，还是表格关联出了问题？写一个可检查的猜想。" onChange={e=>update({...a,hypothesis:e.target.value})}/></label><div className={styles.actions}><button type="button" onClick={()=>run('diagnostic')}>运行异常批次</button>{[['ids','核对两张表的 ID'],['units','核对单位'],['missing','检查缺失值']].map(([id,label])=><button type="button" key={id} onClick={()=>update({...a,probes:Array.from(new Set([...a.probes,id]))})}>{label}</button>)}</div>{a.probes.map(p=><p className={styles.notice} key={p}>{probeEvidence(p)}</p>)}<label className={styles.field}>我的关联策略<select aria-label="我的关联策略" value={a.config.join} onChange={e=>change({...a.config,join:e.target.value as Config['join']})}><option value="row">按返回的行号对应</option><option value="id">按分子 ID 查找对应项</option></select></label><label className={styles.field}>哪两项证据支持这个修复<input maxLength={600} value={a.repairReason} placeholder="引用刚才的检查结果；修改后再次运行异常批次。" onChange={e=>update({...a,repairReason:e.target.value})}/></label></>}
    {kind==='challenge'&&<ChallengeControls a={a} stage={stage} locked={locked} update={update}/>}
    <div className={styles.actions}>
      {kind==='filter'&&stage>=2&&<button type="button" className={styles.primary} onClick={()=>run('filter')}>运行这套筛选条件</button>}
      {kind==='prediction'&&stage>=2&&<button type="button" className={styles.primary} onClick={()=>run('validation')}>在同一验证集上检验</button>}
      {kind==='desk'&&stage!==3&&<button type="button" className={styles.primary} onClick={()=>run('pipeline')}>运行当前工作台</button>}
      {kind==='desk'&&stage>=4&&<button type="button" onClick={()=>run('transfer')}>新情境：预算缩减到 60%</button>}
      {kind==='challenge'&&stage<=2&&<button type="button" onClick={()=>run('validation')}>用验证集预演当前方法</button>}
      {kind==='challenge'&&stage===4&&<button type="button" className={styles.primary} disabled={!a.firstBlind} onClick={()=>run('blind')}>运行修订方案（事后探索）</button>}
    </div>
    {(kind==='prediction'&&stage>=3||kind==='challenge'&&stage>=3&&a.firstBlind)&&<><label className={styles.field}>选择一个需要解释的误差案例<select aria-label="选择一个需要解释的误差案例" value={a.selectedError} onChange={e=>update({...a,selectedError:e.target.value})}><option value="">选择一个样本</option>{pool(kind==='challenge'?'blind':'validation').map(m=><option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}</select></label>{error&&<div className={styles.errorCase}><strong>{error.id} · {error.name}</strong><p>预测 {FMT(error.prediction)} / 实测 {FMT(error.measured)} / 绝对误差 {FMT(error.error)}</p><p>误差方向：{error.prediction===error.measured?'预测与测量相等':error.prediction!>error.measured!?'高估水溶解度':'低估水溶解度'}。解释请引用这一行，不要只说“模型不准”。</p></div>}</>}
    {(last||kind==='desk'&&stage===5)&&<><label className={styles.field}>我的选择理由<input maxLength={700} value={a.reason} placeholder="例：我选了哪种方法？哪一次比较、哪个样本支持或反对这个选择？请写自己的证据。" onChange={e=>update({...a,reason:e.target.value})}/></label><label className={styles.field}>我的作品还不能说明什么<input maxLength={700} value={a.limitation} placeholder="例：小样本结果还不能推广到哪些分子？水溶解度为何不能证明药效？" onChange={e=>update({...a,limitation:e.target.value})}/></label>{kind==='challenge'&&<label className={styles.field}>对预先标准的判断<input maxLength={700} value={a.conclusion} placeholder="引用第一次 MAE 和原先标准；修订结果需明确说是在看到答案之后得到的。" onChange={e=>update({...a,conclusion:e.target.value})}/></label>}</>}
    </fieldset>
    {message&&<p className={styles.notice} role="status">{message}</p>}
    {recent&&<><h4>{same?'本次实验结果':'旧配置的结果 · 修改后需重新运行'}{recent.mode==='blind'?' / 事后探索':''}{recent.mode==='diagnostic'?' / 异常批次':''}{recent.mode==='transfer'?' / 缩减预算':''}</h4><ResultView result={recent.result} selected={a.selectedError} onSelect={id=>update({...a,selectedError:id})}/></>}
    {a.runs.length>0&&<details className={styles.history}><summary>比较我的实验版本 · 最近 {a.runs.length} 次</summary>{a.runs.map((r,i)=><details key={i}><summary>第 {i+1} 次 · {r.mode} · {METHODS[r.config.method]} · 保留 {r.result.selected} · MAE {FMT(r.result.mae)}</summary><p>分子量 ≤ {r.config.maxMass} · logP ≤ {r.config.maxLogP} · 特征 {r.config.features==='mass'?'分子量':'三属性'} · 预算 {r.result.budget} · 用掉 {r.result.spent} · 覆盖 {r.result.coverage} 类环数</p><ResultView result={r.result}/></details>)}</details>}
    <LearningRecordStatus record={record}/><p className={styles.caption}>计算筛选作品不构成药效证明或用药建议。本课不需要购买、接触或配制这些化学品。</p>
  </section><BiomedUnderstandingCheck project={course.id} node={node.module_id}/>{last&&<Delivery course={course} a={a} ready={record.ready&&!locked}/>}</>
}
