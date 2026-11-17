import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PostTrainingClassroom } from "../post-training-classroom"
import { MODULE_IDS, type ModuleId } from "../record"
import type { CourseModule } from "../types"
export const metadata: Metadata = { title: "LLM 后训练工程 · 专业课程", description: "从 SFT 训练循环到 LoRA / QLoRA，交付可复现的领域适配项目。" }
export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  if (!MODULE_IDS.includes(moduleId as ModuleId)) notFound()
  const root = path.join(process.cwd(), "../../standalone-courses/llm-post-training")
  const [manifest, markdown] = await Promise.all([
    readFile(path.join(root, "course.json"), "utf8"), readFile(path.join(root, "nodes", `${moduleId}.md`), "utf8")])
  const modules = JSON.parse(manifest).modules as CourseModule[]
  return <PostTrainingClassroom key={moduleId} modules={modules} moduleId={moduleId as ModuleId} markdown={markdown} />
}
