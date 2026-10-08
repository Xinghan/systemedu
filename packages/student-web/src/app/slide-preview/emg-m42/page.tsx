import fs from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import { M42SlidePreview } from "@/components/learning/m42-slide-preview"
import { normalizeSlides } from "@/lib/normalize-slides"
export default async function Page() {
  if(process.env.NODE_ENV!=="development")notFound()
  const source=path.resolve(process.cwd(),"../../course_factory/fixtures/emg-prosthetic-hand/M42-multimodal-v1.json")
  const data=JSON.parse(await fs.readFile(source,"utf8"))
  return <M42SlidePreview slides={normalizeSlides(data.slides,"M42")}/>
}
