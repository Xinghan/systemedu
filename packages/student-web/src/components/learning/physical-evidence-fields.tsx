"use client"
import {useState,useRef,useEffect} from "react"
import {type PhysicalEvidence,type PhysicalTest} from "@/lib/project-lines/rover-system"
import styles from "./rover-system-workspace.module.css"

async function evidenceJPEG(file:File):Promise<string>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12_000_000)throw Error('请选择不超过 12 MB 的 JPG、PNG 或 WebP 照片。')
  const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');let size=720,result=''
  try{for(let i=0;i<5;i++){const ratio=Math.min(1,size/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const ctx=canvas.getContext('2d');if(!ctx)throw Error('此浏览器无法处理照片。');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);result=canvas.toDataURL('image/jpeg',.72-i*.06);if(result.length<=60000)return result;size*=.8}throw Error('照片细节过多，请选择更简洁的取景。')}finally{bitmap.close()}
}
export function PhysicalEvidenceFields({value,onChange,disabled=false,part='all'}:{value:PhysicalEvidence;onChange:(v:PhysicalEvidence)=>void;disabled?:boolean;part?:'fabrication'|'electronics'|'all'|'photos'}){
  const latest=useRef(value)
  useEffect(()=>{latest.current=value},[value])
  const [message,setMessage]=useState(''),[uploading,setUploading]=useState(false)
  const field=(key:keyof PhysicalEvidence,label:string,placeholder:string)=><label className={styles.field} key={key}>{label}<input aria-label={label} value={String(value[key])} maxLength={600} placeholder={placeholder} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>
  const updateTest=(i:number,key:keyof PhysicalTest,v:string)=>onChange({...value,tests:value.tests.map((t,j)=>j===i?{...t,[key]:v}:t)})
  async function addPhoto(file?:File){if(!file)return;setUploading(true);setMessage('');try{const data=await evidenceJPEG(file);onChange({...latest.current,photos:[...latest.current.photos,{id:crypto.randomUUID(),data,caption:''}]});setMessage('照片压缩副本已加入作品，随后按当前保存状态同步。')}catch(e){setMessage(e instanceof Error?e.message:'照片未能读取，请重试。')}finally{setUploading(false)}}
  async function sourceFile(key:'cadSource'|'controlSource',file?:File){if(!file)return;setUploading(true);try{if(file.size>16000)throw Error('源文件需小于 16 KB，请仅提交本课相关的文本源代码。');const text=await file.text();if(!text.trim()||text.includes('\0'))throw Error('请选择非空的文本源文件。');onChange({...latest.current,[key]:text});setMessage('源文件文本已加入作品，不在浏览器执行。')}catch(e){setMessage(e instanceof Error?e.message:'读取失败')}finally{setUploading(false)}}
  const source=(key:'cadSource'|'controlSource',label:string,accept:string)=><div><label className={styles.upload}>{label}<input aria-label={label} type="file" accept={accept} onChange={e=>{void sourceFile(key,e.target.files?.[0]);e.target.value=''}}/></label>{value[key]&&<details><summary>查看已附入源码 · {new TextEncoder().encode(value[key]).length} 字节</summary><pre className={styles.sourceCode}>{value[key]}</pre><button type="button" onClick={()=>onChange({...value,[key]:''})}>移除此源文件</button></details>}</div>
  return <fieldset disabled={disabled||uploading} className={styles.evidence} data-physical-evidence>
    {(part==='all'||part==='fabrication')&&<><h4>记录你实际打印和装配的部件</h4><p>先打印试配片，再决定孔径与安装方式。例：孔的设计直径 3.4 mm，打印后螺丝仍偏紧；修改后重新试配。填写自己的数值。</p><div className={styles.twoCols}>{field('width','实物底板宽度（mm）','用尺或卡尺测量')}{field('material','打印材料与设置','如材料、层高、摆放方向')}{field('fitBefore','第一次试配结果','尺寸、偏紧或松动的位置')}{field('fitAfter','修改后试配结果','改变了什么，重新测得多少')}{field('cadChange','我的结构修改','尺寸、开孔、固定方式及理由')}</div>{source('cadSource','上传我修改后的 CAD 源文件（.scad）','.scad,text/plain')}</>}
    {(part==='all'||part==='electronics')&&<><h4>记录实物电路与程序</h4><div className={styles.twoCols}>{field('board','实际控制板','填写确切板型')}{field('motor','实际电机与驱动板','填写型号和额定电压')}{field('supply','实际供电与接线','控制板与电机怎样供电、怎样共地')}{field('codeChange','我的程序修改','如左右轮方向、速度或停止条件')}</div><label className={styles.confirm}><input type="checkbox" checked={value.adultChecked} onChange={e=>onChange({...value,adultChecked:e.target.checked})}/>成人已现场核对断电接线、供电极性、共地与独立断电开关，首次通电时车轮架空。</label>{source('controlSource','上传我修改后的控制程序（.py）','.py,text/plain')}</>}
    {part==='all'&&<><h4>保留原始测量，包括没有达到目标的尝试</h4><p>在地面围定测试区，先架空检查停止，再低速落地。前进：目标至少 30 cm、误差不超过 20%；转向：目标 90°、误差不超过 30°；触碰停止：记录触发后的继续移动距离，目标最多 10 cm。数值由你测量，平台只做自检计算。</p>
      <div className={styles.testButtons}>{(['straight','turn','stop'] as const).map(kind=><button type="button" key={kind} disabled={value.tests.length>=12} onClick={()=>onChange({...value,tests:[...value.tests,{id:crypto.randomUUID(),kind,target:kind==='straight'?'50':kind==='turn'?'90':'5',measured:'',surface:'',revision:'',note:''}]})}>添加{kind==='straight'?'前进':kind==='turn'?'转向':'停止'}测试</button>)}</div>
      {value.tests.map((t,i)=><div key={t.id} className={styles.testRow} data-physical-test><header><strong>第 {i+1} 次 · {t.kind==='straight'?'前进距离 / cm':t.kind==='turn'?'转向角度 / °':'触发后继续移动 / cm'}</strong><button type="button" onClick={()=>onChange({...value,tests:value.tests.filter((_,j)=>j!==i)})}>移除这条</button></header><div className={styles.twoCols}>{([['target','目标'],['measured','实测值'],['surface','地面与条件'],['revision','本次结构和程序版本'],['note','结果与下一步']] as const).map(([key,label])=><label key={key} className={styles.field}>{label}<input aria-label={`测试 ${i+1} ${label}`} value={t[key]} maxLength={500} inputMode={key==='target'||key==='measured'?'decimal':'text'} onChange={e=>updateTest(i,key,e.target.value)} placeholder={key==='note'?'写实际现象，未达到目标也保留':''}/></label>)}</div></div>)}
    </>}
    {(part==='all'||part==='photos')&&<><h4>{part==='photos'?'两张远征现场照片：路线与观察结果':'两张实物照片：结构与接线、带标尺的测试现场'}</h4><p>照片只拍作品和测试场地即可。保存压缩副本用于回看，原图请自行留存；照片与测量仍待评阅，上传不会自动证明实测成功。</p><label className={styles.upload}>添加实物照片（{value.photos.length} / 2）<input type="file" accept="image/jpeg,image/png,image/webp" disabled={value.photos.length>=2||uploading} onChange={e=>{void addPhoto(e.target.files?.[0]);e.target.value=''}}/></label>
      <div className={styles.twoCols}>{value.photos.map((photo,i)=><figure key={photo.id} className={styles.photo}>{/* 保存学生上传的照片副本，不替学生生成实物证据。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.data} alt={photo.caption||`实物证据 ${i+1}`}/><label className={styles.field}>照片 {i+1} 说明<input aria-label={`照片 ${i+1} 说明`} value={photo.caption} maxLength={300} placeholder="这张照片对应哪个部件、版本或测试？" onChange={e=>onChange({...value,photos:value.photos.map((p,j)=>j===i?{...p,caption:e.target.value}:p)})}/></label><button type="button" onClick={()=>onChange({...value,photos:value.photos.filter((_,j)=>j!==i)})}>移除照片</button></figure>)}</div>
    </>}
    {message&&<p role="status">{message}</p>}
  </fieldset>
}
