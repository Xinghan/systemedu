import "server-only"
import fs from "node:fs/promises"
import path from "node:path"
import { TEACHOPENCADD_SLUG, type TeachOpenCADDRecordConfig } from "@/lib/teachopencadd-preview"

export const TEACHOPENCADD_PREVIEW_ROOT = path.resolve(process.cwd(), "../../../systemeduidea/projects_data", TEACHOPENCADD_SLUG)
export type TeachOpenCADDManifest = {
  title?: string
  version?: string
  knodes: { module_id: string; knode_dir: string; title?: string; stage_id?: string }[]
  files: { path: string }[]
}

export function allowsTeachOpenCADDPreview(host: string | null) {
  return process.env.NODE_ENV === "development" && !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
}

export function isTeachOpenCADDRelativePath(relative: string) {
  return !!relative && !path.isAbsolute(relative) && !/[\\\u0000-\u001f]/.test(relative) && relative.split("/").every(part => part !== ".." && part !== "." && part !== "")
}

export async function teachopencaddFilePath(relative: string) {
  if (!isTeachOpenCADDRelativePath(relative)) throw new Error("Invalid TeachOpenCADD path")
  const root = await fs.realpath(TEACHOPENCADD_PREVIEW_ROOT)
  const resolved = await fs.realpath(path.join(root, relative))
  if (!resolved.startsWith(root + path.sep)) throw new Error("TeachOpenCADD file outside course directory")
  return resolved
}

export async function readTeachOpenCADDText(relative: string) {
  return fs.readFile(await teachopencaddFilePath(relative), "utf8")
}

export async function readTeachOpenCADDJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readTeachOpenCADDText(relative)) as T
}

export async function readTeachOpenCADDManifest(): Promise<TeachOpenCADDManifest> {
  const manifest = await readTeachOpenCADDJson<TeachOpenCADDManifest>("manifest.json")
  if (!Array.isArray(manifest.knodes) || !manifest.knodes.length || !Array.isArray(manifest.files)) throw new Error("Incomplete TeachOpenCADD manifest")
  const modules = new Set<string>()
  for (const entry of manifest.knodes) {
    if (!entry || !/^M\d{2,3}$/.test(entry.module_id) || !isTeachOpenCADDRelativePath(entry.knode_dir) || !entry.knode_dir.startsWith(`knodes/${entry.module_id}-`) || modules.has(entry.module_id)) throw new Error("Invalid TeachOpenCADD module entry")
    modules.add(entry.module_id)
  }
  if (!manifest.files.every(file => file && typeof file.path === "string" && isTeachOpenCADDRelativePath(file.path))) throw new Error("Invalid TeachOpenCADD file manifest")
  return manifest
}

export function validateTeachOpenCADDRecord(config: TeachOpenCADDRecordConfig): TeachOpenCADDRecordConfig {
  const text = (value: unknown, max = 10000) => typeof value === "string" && value.trim().length > 0 && value.length <= max
  if (!config || !Array.isArray(config.questions) || !config.questions.length || config.questions.length > 50 || !config.questions.every(question => text(question)) || !text(config.output)) throw new Error("Invalid TeachOpenCADD learning questions")
  for (const questions of [config.quiz, config.exam ?? []]) {
    if (!Array.isArray(questions) || questions.length > 100) throw new Error("Invalid TeachOpenCADD assessment")
    const ids = new Set<string>()
    for (const question of questions) {
      if (!question || !text(question.id, 100) || ids.has(question.id) || !text(question.question) || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 10 || !question.options.every(option => text(option, 2000)) || !Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length || !text(question.explanation)) throw new Error("Invalid TeachOpenCADD assessment question")
      ids.add(question.id)
    }
  }
  if (config.response_prompts !== undefined) {
    if (!Array.isArray(config.response_prompts) || config.response_prompts.length > config.questions.length) throw new Error("Invalid TeachOpenCADD response prompts")
    for (const prompt of config.response_prompts) {
      if (!prompt || !text(prompt.title) || !text(prompt.hint) || !text(prompt.example) || !Array.isArray(prompt.fields) || !prompt.fields.length || prompt.fields.length > 20) throw new Error("Invalid TeachOpenCADD response prompt")
      const ids = new Set<string>()
      for (const field of prompt.fields) {
        if (!field || !text(field.id, 100) || ids.has(field.id) || !text(field.label) || !["choice", "short", "text"].includes(field.type) || (field.type === "choice" && (!Array.isArray(field.options) || !field.options.length || !field.options.every(option => text(option, 2000))))) throw new Error("Invalid TeachOpenCADD response field")
        ids.add(field.id)
      }
    }
  }
  return config
}

export const teachopencaddMediaUrl = (relative: string) => `/preview/teachopencadd/media?path=${encodeURIComponent(relative)}`
