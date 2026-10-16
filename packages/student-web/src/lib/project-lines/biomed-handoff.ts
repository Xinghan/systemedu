import type { LearningBody, LearningScope } from "../api/learning-records"
import { bioGroup } from "./biomed-mission"
export const HANDOFF_FIELDS = [
 ["input","我沿用了哪份输入？","例如：raw-v1.csv；ESOL 练习与正式靶点数据分开。"],
 ["output","这次留下的作品在哪里？","例如：原课堂的正式作品页，或本人文件夹 / descriptors-v2.csv。"],
 ["version","这份作品的版本是什么？","例如：2026-10-13 / 配置 v2；第一次结果文件保持只读。"],
 ["evidence","我实际检查了什么？","例如：用分子 ID 核对三行；记录一次失败及原因。"],
 ["transfer","交给下一步时要注意什么？","例如：规则来自教学样本，迁移前需在正式研究表上重新核对。"],
] as const
export type HandoffSnapshot={id:string;at:string;values:Record<string,string>}
export const initialHandoff=():LearningBody=>({answers:HANDOFF_FIELDS.map(([id,question])=>({question_id:id,question,answer:""})),artifact:{schema:"biomed-research-handoff/1",snapshots:[]}})
export function handoffScope(group:string):LearningScope {
 if(!bioGroup(group))throw new Error("未知研究任务段")
 return {library_slug:"biomedicine",module_id:"JOURNEY",activity_id:`research-handoff-${group}`,kind:"assignment",content_version:"1.0"}
}
export function handoffFrom(body:LearningBody):HandoffSnapshot[]|null {
 if(!Array.isArray(body.answers)||body.answers.length!==HANDOFF_FIELDS.length||!HANDOFF_FIELDS.every(([id])=>body.answers.filter(a=>a.question_id===id&&typeof a.answer==="string"&&a.answer.length<=800).length===1))return null
 const a=body.artifact
 if(!a||a.schema!=="biomed-research-handoff/1"||!Array.isArray(a.snapshots)||a.snapshots.length>50)return null
 const valid=a.snapshots.every(v=>v&&typeof v==="object"&&typeof v.id==="string"&&typeof v.at==="string"&&Number.isFinite(Date.parse(v.at))&&v.values&&typeof v.values==="object"&&HANDOFF_FIELDS.every(([id])=>typeof v.values[id]==="string"&&v.values[id].length<=800))
 return valid?a.snapshots as HandoffSnapshot[]:null
}
export function sealHandoff(body:LearningBody,id:string,at:string):LearningBody {
 const saved=handoffFrom(body)
 if(!saved)throw new Error("记录格式无法识别，保留原始数据")
 if(saved.length>=50)throw new Error("已保留 50 份版本，请先导出核对；旧版本未删除。")
 if(body.answers.some(a=>!a.answer.trim()))throw new Error("请先填写这份交接的五项信息")
 const values=Object.fromEntries(body.answers.map(a=>[a.question_id,a.answer]))
 return {...body,artifact:{schema:"biomed-research-handoff/1",snapshots:[...saved,{id,at,values}]}}
}
