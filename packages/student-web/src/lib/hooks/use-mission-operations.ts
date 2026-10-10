"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLearningRecord } from "./use-learning-record"
import { learningCacheKey } from "../learning-record-session"
import { SPACE_ENGINE, type MissionEngine, localDay, heartbeatSeconds, type MissionOperations } from "../project-lines/space-mission-operations"
import type { LearningBody } from "../api/learning-records"

export function useMissionOperations(engine: MissionEngine = SPACE_ENGINE) {
  const {scope:OPERATIONS_SCOPE,INITIAL_OPERATIONS,operationsFrom}=engine
  const record=useLearningRecord(OPERATIONS_SCOPE,INITIAL_OPERATIONS)
  const [message,setMessage]=useState("")
  const update=useCallback((change:(ops:MissionOperations)=>MissionOperations) => {
    const current=record.session.snapshot()
    if (!current.ready || current.conflict || current.pending || (current.attention && record.session.token)) return false
    let body=current.body
    try {
      // Merge guest edits against the latest same-identity browser copy, not a stale tab.
      if (!record.session.token) { const raw=localStorage.getItem(record.session.cacheKey); if(raw) body=JSON.parse(raw).body as LearningBody }
      const ops=operationsFrom(body);if(!ops)throw new Error("记录格式无法读取，原数据保留，请先导出核对。")
      const next={...body,artifact:change(ops) as unknown as Record<string,unknown>}
      if(!operationsFrom(next))throw new Error("这次输入格式不完整，请检查日期和记录内容；上一版仍保留。")
      if(new TextEncoder().encode(JSON.stringify(next)).length>240000)throw new Error("记录接近容量上限，请先导出备份并缩短备注。")
      record.session.update(next);setMessage("");return true
    }catch(e){setMessage(e instanceof Error?e.message:"记录未更新，请重试。");return false}
  },[record.session,operationsFrom])
  useEffect(()=>{
    const refresh=()=>{
      const state=record.session.snapshot()
      if(!state.ready||state.busy||state.pending||state.conflict)return
      if(record.session.token){if(!state.dirty)void record.session.refresh();return}
      try { const raw=localStorage.getItem(learningCacheKey(record.identity.owner,OPERATIONS_SCOPE));if(!raw)return;const body=JSON.parse(raw).body as LearningBody;if(operationsFrom(body)&&JSON.stringify(body)!==JSON.stringify(state.body))record.session.update(body) }catch{/* Keep the current readable state. */}
    }
    const storage=(e:StorageEvent)=>{if(e.key===record.session.cacheKey)refresh()}
    window.addEventListener("focus",refresh);window.addEventListener("storage",storage)
    return ()=>{window.removeEventListener("focus",refresh);window.removeEventListener("storage",storage)}
  },[record.session,record.identity.owner,OPERATIONS_SCOPE,operationsFrom])
  return {engine,record,ops:operationsFrom(record.body),update,message}
}
export type MissionRecord = ReturnType<typeof useMissionOperations>

export function useMissionWork(model: MissionRecord, taskId:string) {
  const [running,setRunning]=useState(false),[elapsed,setElapsed]=useState(0),[message,setMessage]=useState("")
  const current=useRef(model)
  useLayoutEffect(()=>{current.current=model},[model])
  const active=useRef<{id:string;task:string;start:string;seconds:number;last:number;release:()=>void;lastSaved:number}|null>(null)
  const requesting=useRef(false),mounted=useRef(true),generation=useRef(0)
  const persist=useCallback((reason:string)=>{
    const block=active.current;if(!block)return true
    const now=new Date(),amount=Math.floor(block.seconds)
    if(amount===0)return true
    const ok=current.current.update(ops=>current.current.engine.recordWork(ops,{id:block.id,task:block.task,startedAt:block.start,endedAt:now.toISOString(),seconds:amount,reason},localDay(now)))
    if(ok)block.lastSaved=amount
    return ok
  },[])
  const pause=useCallback((reason="已暂停")=>{
    const block=active.current;if(!block)return
    persist(reason);active.current=null;block.release();void current.current.record.session.save()
    if(mounted.current){setRunning(false);setMessage(reason)}
  },[persist])
  const start=useCallback(async()=>{
    if(active.current||requesting.current||!document.hasFocus()||document.hidden)return
    const r=current.current.record
    if(!r.ready||r.conflict||r.pending||r.attention||!current.current.ops){setMessage("先完成记录读取或处理同步问题，再开始计时。");return}
    if(!navigator.locks){setMessage("当前浏览器不支持单标签页计时，请换用支持此功能的浏览器；任务仍可正常学习。");return}
    requesting.current=true
    const startedGeneration=generation.current
    try {
      await navigator.locks.request(`systemedu:space-work:${r.identity.owner}`,{ifAvailable:true},async lock=>{
        if(!mounted.current||generation.current!==startedGeneration)return
        if(!lock){setMessage("另一标签页正在计时，请先在那里暂停。");return}
        if(r.identity.token)await r.session.refresh()
        if(!mounted.current||generation.current!==startedGeneration||document.hidden)return
        const latest=r.session.snapshot()
        if(!latest.ready||latest.conflict||latest.attention){setMessage("同步尚未完成，本次尚未计时。");return}
        await new Promise<void>(release=>{
          active.current={id:crypto.randomUUID(),task:taskId,start:new Date().toISOString(),seconds:0,last:performance.now(),release,lastSaved:0}
          setElapsed(0);setMessage("");setRunning(true)
        })
      })
    }catch{if(mounted.current)setMessage("未能启动计时，请重试。")}
    finally{requesting.current=false}
  },[taskId])
  useEffect(()=>{
    mounted.current=true
    const tick=()=>{
      const b=active.current;if(!b)return
      const state=current.current.record.session.snapshot()
      if(state.conflict||state.attention){pause("同步遇到问题，计时已暂停；已写入本机的记录保留。");return}
      if(document.hidden){pause("离开前台，已暂停");return}
      const now=performance.now();b.seconds=Math.min(1200,b.seconds+heartbeatSeconds(b.last,now,true));b.last=now
      setElapsed(Math.floor(b.seconds))
      if(Math.floor(b.seconds)-b.lastSaved>=10&&!persist("计时检查点"))pause("记录未能保存，已暂停")
      if(b.seconds>=1200)pause("本段 20 分钟已结束，可休息后开始下一段")
    }
    const hidden=()=>{if(document.hidden)pause("离开前台，已暂停")}
    const leaving=()=>pause("离开任务，已暂停")
    const timer=setInterval(tick,1000);document.addEventListener("visibilitychange",hidden);window.addEventListener("pagehide",leaving)
    return ()=>{generation.current++;mounted.current=false;pause("离开任务，已暂停");clearInterval(timer);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",leaving)}
  },[pause,persist,taskId])
  return {running,elapsed,message,start,pause}
}
