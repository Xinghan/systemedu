/** Versioned teaching models. Synthetic observations are never labelled as measurements. */
export const EARTH_IDS = ['spot-a-landscape-change','follow-an-ant','read-an-air-day','make-an-observation-map','assemble-a-field-notebook'] as const
export type EarthId=typeof EARTH_IDS[number]
export const FINAL:Record<EarthId,string>={'spot-a-landscape-change':'M01','follow-an-ant':'M01','read-an-air-day':'M04','make-an-observation-map':'M04','assemble-a-field-notebook':'M05'}
export const AIR=[12,11,10,9,10,14,23,38,31,22,18,16,null,null,17,19,21,27,35,28,23,19,16,14] as const
export const AIR_META={id:'earth-air-v1',origin:'simulated',date:'2026-05-12',timezone:'UTC+08:00',unit:'µg/m³',interval:'1 hour',site:'P2（虚构场地树荫点）'}
export type AirConfig={window:1|3|5;missing:'gap'|'zero'}
export type AirRun={id:string;at:string;config:AirConfig;values:(number|null)[];peak:number;peakHour:number;mean:number;valid:number}
export const SITES=[{id:'P1',name:'入口',x:18,y:18,value:38,kind:'measured'},{id:'P2',name:'树荫',x:48,y:56,value:21,kind:'measured'},{id:'P3',name:'池边',x:96,y:30,value:26,kind:'estimated'}] as const
export type Pin={id:string;x:number;y:number;kind:'measured'|'estimated'|'unknown'}
export type Mark={id:string;x:number;y:number;label:'water'|'land'|'uncertain'}
export type Track={t:number;x:number|null;y:number|null}
export type LinkConfig={time:'raw'|'utc8';unit:'raw'|'convert';join:'row'|'id'}
export type LinkRun={id:string;at:string;config:LinkConfig;basis:string;issues:string[];rows:{id:string;hour:number;value:number|null;match:string}[]}
export type EarthArtifact={schema:'earth/1';project:EarthId;marks:Mark[];track:Track[];air:AirConfig;runs:AirRun[];peakHour:number;gapHour:number;pins:Pin[];samples:{x:number;y:number}[];decision:string;limit:string;question:string;hypothesis:string;repair:string;probes:string[];link:LinkConfig;tests:LinkRun[];sources:{project:EarthId;submission:string;at:string;air?:{config:AirConfig;run:AirRun};map?:{pins:Pin[];samples:{x:number;y:number}[]}}[]}
export function fresh(project:EarthId):EarthArtifact{return {schema:'earth/1',project,marks:[],track:[],air:{window:1,missing:'gap'},runs:[],peakHour:-1,gapHour:-1,pins:[],samples:[],decision:'',limit:'',question:'',hypothesis:'',repair:'',probes:[],link:{time:'raw',unit:'raw',join:'row'},tests:[],sources:[]}}
export function canonical(x:unknown):string{if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(x)}
export function airRun(c:AirConfig,id='preview',at=''):AirRun{
 const values=AIR.map((v,i)=>{if(v===null&&c.missing==='gap')return null;const start=i-c.window+1;if(start<0)return null;const chunk=AIR.slice(start,i+1);if(c.missing==='gap'&&chunk.some(x=>x===null))return null;return chunk.reduce<number>((sum,x)=>sum+(x??0),0)/c.window})
 const nums=values.filter((x):x is number=>x!==null),peak=Math.max(...nums);return {id,at,config:{...c},values,peak,peakHour:values.indexOf(peak),mean:nums.reduce((s,x)=>s+x,0)/nums.length,valid:nums.length}
}
export function antAt(t:number){const knots=[[125,410],[238,351],[363,388],[497,292],[623,246],[751,323],[872,229]],i=Math.min(5,Math.floor(t/2)),u=Math.min(1,(t-i*2)/2),x=knots[i][0]+(knots[i+1][0]-knots[i][0])*u,y=knots[i][1]+(knots[i+1][1]-knots[i][1])*u;return {x,y,angle:Math.atan2(knots[i+1][1]-knots[i][1],knots[i+1][0]-knots[i][0])*180/Math.PI,hidden:t>=5.5&&t<=6.5}}
export const originLabels={measured:'预置测量',estimated:'估计',unknown:'未测'}
export function sourceBasis(a:EarthArtifact){return canonical(a.sources)}
export function linkRun(a:EarthArtifact,id='preview',at=''):LinkRun{
 // Packaged export is deliberately reordered. Its UTC clock and mg/m³ unit must be adapted.
 const config={...a.link},sourceAir=a.sources.find(s=>s.air)?.air,sourceMap=a.sources.find(s=>s.map)?.map;
 const signal=sourceAir?sourceAir.run.values[16]:AIR[16]!;
 const ids=sourceMap?.pins.map(p=>p.id).sort()??['P1','P2','P3'];
 const external=[{id:'P3',raw:.026},{id:'P1',raw:.038},{id:'P2',raw:signal===null?null:signal/1000}];
 const rows=external.map((r,i)=>({id:r.id,hour:config.time==='utc8'?16:8,value:r.raw===null?null:config.unit==='convert'?r.raw*1000:r.raw,match:config.join==='id'?r.id:ids[i]??'unknown'}));
 const issues:string[]=[];if(config.time!=='utc8')issues.push('UTC 08:00 尚未对齐本地 16:00');if(config.unit!=='convert')issues.push('mg/m³ 被当成 µg/m³，数值小了 1000 倍');if(rows.some(r=>r.id!==r.match))issues.push('点位按行号拼接，P1/P2/P3 与位置错配');
 return {id,at,config,basis:sourceBasis(a),issues,rows}
}
const text=(x:unknown,n=1200):x is string=>typeof x==='string'&&x.length<=n
const num=(x:unknown,min:number,max:number):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max
const airOK=(x:AirConfig)=>x&&[1,3,5].includes(x.window)&&['gap','zero'].includes(x.missing)
const pinOK=(p:Pin)=>p&&SITES.some(s=>s.id===p.id)&&num(p.x,0,120)&&num(p.y,0,80)&&['measured','estimated','unknown'].includes(p.kind)
const sampleOK=(p:{x:number;y:number})=>p&&num(p.x,0,120)&&num(p.y,0,80)
const linkOK=(c:LinkConfig)=>c&&['raw','utc8'].includes(c.time)&&['raw','convert'].includes(c.unit)&&['row','id'].includes(c.join)
const runOK=(r:AirRun)=>r&&airOK(r.config)&&text(r.id,100)&&text(r.at,60)&&canonical(airRun(r.config,r.id,r.at))===canonical(r)
function sourceOK(s:EarthArtifact['sources'][number]):boolean {
 if(!s || !text(s.submission,120) || !text(s.at,100)) return false;
 if(s.project==='read-an-air-day') return !!s.air && airOK(s.air.config) && runOK(s.air.run) && canonical(s.air.config)===canonical(s.air.run.config);
 if(s.project==='make-an-observation-map') return !!s.map && Array.isArray(s.map.pins) && s.map.pins.length===3 && new Set(s.map.pins.map(p=>p.id)).size===3 && s.map.pins.every(pinOK) && Array.isArray(s.map.samples) && s.map.samples.length>=2 && s.map.samples.length<=3 && s.map.samples.every(sampleOK);
 return false;
}
function sourcesOK(s:EarthArtifact['sources']):boolean {
 return Array.isArray(s) && s.length<=2 && new Set(s.map(p=>p.project)).size===s.length && s.every(sourceOK);
}
function testOK(t:LinkRun):boolean {
 if(!t || !text(t.id,100) || !text(t.at,60) || !text(t.basis,15000) || !linkOK(t.config)) return false;
 const sources=JSON.parse(t.basis);
 if(!sourcesOK(sources)) return false;
 const expected=linkRun({...fresh('assemble-a-field-notebook'),sources,link:t.config},t.id,t.at);
 return canonical(expected)===canonical(t);
}
export function validArtifact(v:unknown):v is EarthArtifact {
 try {
  const a=v as EarthArtifact;
  return a?.schema==='earth/1' && EARTH_IDS.includes(a.project)
   && ['decision','limit','question','hypothesis','repair'].every(k=>text(a[k as keyof EarthArtifact]))
   && airOK(a.air) && linkOK(a.link)
   && Number.isInteger(a.peakHour) && num(a.peakHour,-1,23) && Number.isInteger(a.gapHour) && num(a.gapHour,-1,23)
   && Array.isArray(a.marks) && a.marks.length<=5 && a.marks.every(p=>text(p.id,100)&&num(p.x,0,1)&&num(p.y,0,1)&&['water','land','uncertain'].includes(p.label))
   && Array.isArray(a.track) && a.track.length<=7 && new Set(a.track.map(p=>p.t)).size===a.track.length
   && a.track.every(p=>[0,2,4,6,8,10,12].includes(p.t)&&((p.x===null&&p.y===null)||(num(p.x,0,1000)&&num(p.y,0,600))))
   && Array.isArray(a.runs) && a.runs.length<=8 && a.runs.every(runOK)
   && Array.isArray(a.pins) && a.pins.length<=3 && new Set(a.pins.map(p=>p.id)).size===a.pins.length && a.pins.every(pinOK)
   && Array.isArray(a.samples) && a.samples.length<=3 && a.samples.every(sampleOK)
   && sourcesOK(a.sources)
   && Array.isArray(a.probes) && a.probes.length<=3 && a.probes.every(p=>['clock','units','positions'].includes(p))
   && Array.isArray(a.tests) && a.tests.length<=8 && a.tests.every(testOK);
 } catch { return false; }
}
export function checks(a:EarthArtifact):{title:string;passed:boolean}[]{
 const note=[{title:'自己的观察结论与依据',passed:a.decision.trim().length>=12},{title:'明确还不能证明什么',passed:a.limit.trim().length>=10}];
 if(a.project==='spot-a-landscape-change')return [{title:'留下两个不同位置的观察标记',passed:a.marks.length>=2&&a.marks.some((p,i)=>a.marks.some((q,j)=>i!==j&&Math.hypot(p.x-q.x,p.y-q.y)>.08))}];
 if(a.project==='follow-an-ant')return [{title:'六个可见时刻都定位目标，遮挡时保留未知',passed:[0,2,4,8,10,12].every(t=>a.track.some(p=>p.t===t&&p.x!==null&&p.y!==null&&Math.hypot(p.x-antAt(t).x,p.y-antAt(t).y)<=35))&&a.track.some(p=>p.t===6&&p.x===null)}];
 if(a.project==='read-an-air-day')return [{title:'原始最高点与缺测时刻已正确标注',passed:a.peakHour===7&&[12,13].includes(a.gapHour)},{title:'保留两种窗口的对照，并验证当前保留缺测的配置',passed:new Set(a.runs.map(r=>r.config.window)).size>=2&&a.air.missing==='gap'&&a.runs.some(r=>canonical(r.config)===canonical(a.air))},...note];
 if(a.project==='make-an-observation-map')return [{title:'三个点位与各自证据类型对齐',passed:SITES.every(s=>a.pins.some(p=>p.id===s.id&&p.kind===s.kind&&Math.hypot(p.x-s.x,p.y-s.y)<=3))},{title:'两个分开的后续采样点与可检验问题',passed:a.samples.length>=2&&Math.hypot(a.samples[0].x-a.samples[1].x,a.samples[0].y-a.samples[1].y)>=15&&a.question.trim().length>=12},...note];
 const now=linkRun(a),same=a.tests.filter(t=>t.basis===sourceBasis(a)),latest=same.at(-1);
 return [{title:'至少接入一份本人已提交的有效前作',passed:a.sources.length>=1},{title:'先提出假设，选择至少两类探查并说明修复',passed:a.hypothesis.trim().length>=12&&new Set(a.probes).size>=2&&a.repair.trim().length>=12},{title:'当前来源保留失败与修复后复测，三个接口均通过',passed:same.some(t=>t.issues.length>0)&&!!latest&&canonical(latest.config)===canonical(a.link)&&latest.issues.length===0&&now.issues.length===0&&canonical(latest.rows)===canonical(now.rows)},...note];
}
export function remember<T>(xs:T[],x:T){return xs.length<8?[...xs,x]:[xs[0],...xs.slice(-6),x]}
