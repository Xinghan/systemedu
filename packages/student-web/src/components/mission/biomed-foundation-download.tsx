"use client"
import { useState } from "react"
import Link from "next/link"
import { myProjects } from "@/lib/api"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { BIO_FOUNDATIONS, bioLessonHref } from "@/lib/project-lines/biomed-mission"
export function BiomedFoundationDownload({id}:{id:string}) {
 const identity=useLearningIdentity()
 return <Download key={identity.owner+id} id={id} token={identity.token}/>
}
function Download({id,token}:{id:string;token:string|null}) {
 const foundation=BIO_FOUNDATIONS.find(f=>f.id===id)!,[busy,setBusy]=useState(false),[message,setMessage]=useState("")
 if(!foundation)return null
 if(!token)return <Link href={`/login?next=${encodeURIComponent(bioLessonHref(foundation.uses[0]))}`}>登录原课程后下载 {id}</Link>
 async function download(){
  setBusy(true);setMessage("")
  try{
   // The existing endpoint verifies login AND course enrollment; no public asset copy.
   const response=await fetch(myProjects.fileUrl("teachopencadd-candidate-research",foundation.path),{headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(15000)})
   if(!response.ok)throw new Error(response.status===401||response.status===403?"请先登录并加入原课程，再下载基础资料。":response.status===404?"这份原课资料尚未上线，文件路径已保留；请待课程发布后下载。":"暂时无法读取原课资料，请稍后重试。")
   const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${foundation.id}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("已读取原课文件；请查看浏览器下载记录。")
  }catch(e){setMessage(e instanceof Error?e.message:"下载失败，请稍后重试。")}
  finally{setBusy(false)}
 }
 return <><button type="button" disabled={busy} onClick={()=>void download()}>{busy?"读取原课资料…":`下载 ${id} 原文 ↓`}</button>{message&&<span role="status">{message}</span>}</>
}
