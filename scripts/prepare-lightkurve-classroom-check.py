"""Create a removable, development-only fixture using the real unified classroom."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
fixture = root / "packages/student-web/src/app/verification-lightkurve-local"
fixture.mkdir(exist_ok=False)
(fixture / "[moduleId]").mkdir()
(fixture / "media").mkdir()
source = str(args.source.resolve())
(fixture / "[moduleId]/page.tsx").write_text('''import fs from "node:fs/promises"
import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { normalizeSlides } from "@/lib/normalize-slides"
import { CheckClassroom } from "../client"
export const dynamic = "force-dynamic"
export default async function Page({params}: {params: Promise<{moduleId:string}>}) {
 if(process.env.NODE_ENV!=="development" || !/^(127\\.0\\.0\\.1|localhost):/.test((await headers()).get("host")||"")) notFound()
 const {moduleId}=await params
 if(!/^M(0[1-9]|[12][0-9]|3[0-2])$/.test(moduleId)) notFound()
 const root=SOURCE,dir=`knodes/${moduleId}-w0-module`
 const read=async(file:string)=>fs.readFile(`${root}/${file}`,"utf8")
 const [sections,theories,slides,plan,assignment,tree,record]=await Promise.all([read(dir+"/sections.json"),read(dir+"/theories.json"),read(dir+"/slides.json"),read(dir+"/lesson.md"),read(dir+"/assignment.md"),read("tree/knowledge_tree.json"),read(dir+"/learning-record.json")])
 const content={...JSON.parse(sections),theories:JSON.parse(theories),plan_markdown:plan}
 for(const section of Object.values(content.rendered_sections) as {html?:string;html_path?:string}[]) if(!section.html&&section.html_path) section.html=await read(dir+"/"+section.html_path)
 const raw=JSON.parse(slides),deck=normalizeSlides(Array.isArray(raw)?raw:raw.slides,moduleId)
 const media=(src:string)=>"/verification-lightkurve-local/media?path="+encodeURIComponent(src.startsWith("knodes/")?src:dir+"/"+src)
 for(const slide of deck) for(const image of slide.payload.images||[]) if(!/^(https?:|data:|\\/)/.test(image.src))image.src=media(image.src)
 const rawRecord=JSON.parse(record),rawTree=JSON.parse(tree)
 const contentVersion=createHash("sha256").update(JSON.stringify({record:rawRecord,assignment})).digest("hex").slice(0,32)
 const modules=rawTree.modules.map((m:{module_id:string;title:string;stage_id:string})=>({id:m.module_id,title:m.title,stage:m.stage_id}))
 const stages=rawTree.stages.map((s:{stage_id:string;title:string})=>({id:s.stage_id,title:s.title}))
 return <CheckClassroom key={moduleId} moduleId={moduleId} courseTitle="Lightkurve · 凌星调查" modules={modules} stages={stages} knodeDir={dir} content={content} slides={deck} assignment={assignment} recordConfig={rawRecord} contentVersion={contentVersion} images={{}} audio={{}}/>

}
'''.replace("SOURCE", repr(source)))
(fixture / "client.tsx").write_text('''"use client"
import { LightkurveCourseLesson, type LightkurveCourseLessonProps } from "@/components/learning/lightkurve-course-lesson"
export function CheckClassroom(props:LightkurveCourseLessonProps) {
 return <><p className="p-4">本地验收夹具 · 使用正式课堂组件；不模拟生产登录或提交。</p><LightkurveCourseLesson {...props} holdoutUrl="/verification-lightkurve-local/media?path=practice%2Fbrowser%2Fholdout.json" downloadControl={<a href="/verification-lightkurve-local/media?path=downloads%2Flightkurve-practice-kit.zip" download>下载原始 Lightkurve 实践包</a>}/></>
}
''')
(fixture / "media/route.ts").write_text('''import fs from "node:fs/promises"
import path from "node:path"
import { NextRequest } from "next/server"
export async function GET(request:NextRequest){
 if(process.env.NODE_ENV!=="development" || !["localhost","127.0.0.1"].includes(request.nextUrl.hostname))return new Response(null,{status:404})
 const relative=request.nextUrl.searchParams.get("path")||""
 if(!relative||relative.split("/").some(s=>s===".."||s===".")||path.isAbsolute(relative))return new Response(null,{status:400})
 const root=await fs.realpath(SOURCE),file=await fs.realpath(path.join(root,relative))
 if(!file.startsWith(root+path.sep))return new Response(null,{status:404})
 const type=file.endsWith(".zip")?"application/zip":file.endsWith(".png")?"image/png":file.endsWith(".svg")?"image/svg+xml":"application/octet-stream"
 return new Response(await fs.readFile(file),{headers:{"Content-Type":type,...(file.endsWith(".zip")?{"Content-Disposition":"attachment; filename=lightkurve-practice-kit.zip"}:{})}})
}
'''.replace("SOURCE", repr(source)))
print(fixture)
