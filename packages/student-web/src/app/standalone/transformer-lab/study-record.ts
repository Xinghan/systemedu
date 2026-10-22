'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Concept } from '@/lib/transformer-viz/bridge'
import { TOPICS } from './model-content'
import { FOUNDATIONS, type FoundationId } from './study-content'

export type StudyEvent = { at:string; node:Concept; kind:'foundation'|'symbol'|'step'|'experiment'|'answer'|'code'|'environment'; detail:string; pass?:boolean }
export type StudyRecord = { version:1; levels:Partial<Record<Concept,number>>; answers:Record<string,number>; foundations:Partial<Record<FoundationId,number>>; codes:Partial<Record<Concept,string>>; results:Partial<Record<Concept,{code:string;pass:boolean;text:string}>>; events:StudyEvent[] }
const fresh:StudyRecord={version:1,levels:{},answers:{},foundations:{},codes:{},results:{},events:[]}
const ids=TOPICS.map(t=>t.id)
export function validStudyRecord(raw:unknown):raw is StudyRecord {
 if(!raw||typeof raw!=='object')return false
 const n=raw as StudyRecord
 const object=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)
 if(n.version!==1||![n.levels,n.answers,n.foundations,n.codes,n.results].every(object)||!Array.isArray(n.events)||n.events.length>500)return false
 return Object.entries(n.levels).every(([k,v])=>ids.includes(k as Concept)&&Number.isInteger(v)&&v>=0&&v<=4)
  && Object.entries(n.answers).every(([k,v])=>ids.some(id=>k===id+':0'||k===id+':1')&&Number.isInteger(v)&&v>=0&&v<3)
  && Object.entries(n.foundations).every(([k,v])=>k in FOUNDATIONS&&Number.isInteger(v)&&v>=0&&v<3)
  && Object.entries(n.codes).every(([k,v])=>ids.includes(k as Concept)&&typeof v==='string'&&v.length<=20000)
  && Object.entries(n.results).every(([k,r])=>ids.includes(k as Concept)&&r&&typeof r.code==='string'&&r.code.length<=20000&&typeof r.pass==='boolean'&&typeof r.text==='string'&&r.text.length<=30000)
  && n.events.every(e=>e&&ids.includes(e.node)&&typeof e.at==='string'&&typeof e.detail==='string'&&e.detail.length<=1000&&['foundation','symbol','step','experiment','answer','code','environment'].includes(e.kind))
}
export function useStudyRecord(){
 const [record,setRecord]=useState<StudyRecord>(fresh),[ready,setReady]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let alive=true;queueMicrotask(()=>{if(!alive)return;try{const key='transformer-math-path-v1'+(new URLSearchParams(location.search).has('practice')?'-practice':'');const value=localStorage.getItem(key);if(value){const n=JSON.parse(value);if(validStudyRecord(n))setRecord(n);else setError('数学记录格式不兼容，暂不覆盖已有记录。')}}catch{setError('数学记录无法恢复；仍可继续学习。')}setReady(true)});return()=>{alive=false}},[])
 useEffect(()=>{if(!ready||error)return;try{localStorage.setItem('transformer-math-path-v1'+(new URLSearchParams(location.search).has('practice')?'-practice':''),JSON.stringify(record))}catch{queueMicrotask(()=>setError('浏览器未能保存数学记录，请保持页面打开。'))}},[record,ready,error])
 const log=useCallback((node:Concept,kind:StudyEvent['kind'],detail:string,pass?:boolean)=>setRecord(r=>({...r,events:[...r.events,{node,kind,detail:detail.slice(0,1000),pass,at:new Date().toISOString()}].slice(-500)})),[])
 return {record,setRecord,log,ready,error}
}
