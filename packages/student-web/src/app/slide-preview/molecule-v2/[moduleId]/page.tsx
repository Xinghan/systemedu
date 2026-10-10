import fs from 'node:fs/promises'
import path from 'node:path'
import {notFound} from 'next/navigation'
import {normalizeSlides} from '@/lib/normalize-slides'
import numbering from '@/lib/data/molecule-numbering-v2.json'
import {NumberedCoursePreview} from '@/components/learning/numbered-course-preview'

export default async function Page({params}:{params:Promise<{moduleId:string}>}){
  if(process.env.NODE_ENV!=='development')notFound()
  const {moduleId}=await params, entry=numbering.modules.find(m=>m.new===moduleId)
  if(!entry)notFound()
  const dir=entry.old_dir.replace('/'+entry.old+'-','/'+entry.new+'-')
  const root=path.resolve(process.cwd(),'../../../systemeduidea/projects_data/molecule-monster-hunter')
  const raw=JSON.parse(await fs.readFile(path.join(root,dir,'slides.json'),'utf8'))
  const slides=normalizeSlides(Array.isArray(raw)?raw:raw.slides,moduleId)
  const sections=JSON.parse(await fs.readFile(path.join(root,dir,'sections.json'),'utf8'))
  const images:Record<string,string>={},audio:Record<string,string>={}
  const url=(p:string)=>'/slide-preview/molecule-v2/media?path='+encodeURIComponent(p)
  for(const s of slides){
    for(const image of s.payload.images||[])images[image.src]=url(image.src.startsWith('knodes/')?image.src:dir+'/'+image.src.replace(/^\//,''))
    if(s.audio_path)audio[s.audio_path]=url(s.audio_path.startsWith('knodes/')?s.audio_path:dir+'/'+s.audio_path)
  }
  return <NumberedCoursePreview key={moduleId} moduleId={moduleId} title={entry.title} knodeDir={dir} slides={slides} images={images} audio={audio} ideas={sections.ideas||[]} renderedSections={sections.rendered_sections||{}}/>
}
