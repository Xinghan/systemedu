import "server-only"
import fs from "node:fs/promises"
import path from "node:path"
import { LIGHTKURVE_SLUG, type LightkurveRecordConfig } from "@/lib/lightkurve-preview"

export const LIGHTKURVE_PREVIEW_ROOT = path.resolve(process.cwd(), "../../../systemeduidea/projects_data", LIGHTKURVE_SLUG)
export type LightkurveManifest = {
  title?: string
  version?: string
  knodes: { module_id: string; knode_dir: string; title?: string; stage_id?: string }[]
  files: { path: string }[]
}

export function allowsLightkurvePreview(host: string | null) {
  return process.env.NODE_ENV === "development" && !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
}

export function isLightkurveRelativePath(relative: string) {
  return !!relative && !path.isAbsolute(relative) && !/[\\\u0000-\u001f]/.test(relative) && relative.split("/").every(part => part !== ".." && part !== "." && part !== "")
}

export async function lightkurveFilePath(relative: string) {
  if (!isLightkurveRelativePath(relative)) throw new Error("Invalid Lightkurve path")
  const root = await fs.realpath(LIGHTKURVE_PREVIEW_ROOT)
  const resolved = await fs.realpath(path.join(root, relative))
  if (!resolved.startsWith(root + path.sep)) throw new Error("Lightkurve file outside course directory")
  return resolved
}

export async function readLightkurveText(relative: string) {
  return fs.readFile(await lightkurveFilePath(relative), "utf8")
}

export async function readLightkurveJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readLightkurveText(relative)) as T
}

export async function readLightkurveManifest(): Promise<LightkurveManifest> {
  const manifest = await readLightkurveJson<LightkurveManifest>("manifest.json")
  if (!Array.isArray(manifest.knodes) || !manifest.knodes.length || !Array.isArray(manifest.files)) throw new Error("Incomplete Lightkurve manifest")
  const modules = new Set<string>()
  for (const entry of manifest.knodes) {
    if (!entry || !/^M\d{2,3}$/.test(entry.module_id) || !isLightkurveRelativePath(entry.knode_dir) || !entry.knode_dir.startsWith(`knodes/${entry.module_id}-`) || modules.has(entry.module_id)) throw new Error("Invalid Lightkurve module entry")
    modules.add(entry.module_id)
  }
  if (!manifest.files.every(file => file && typeof file.path === "string" && isLightkurveRelativePath(file.path))) throw new Error("Invalid Lightkurve file manifest")
  return manifest
}

export function validateLightkurveRecord(config: LightkurveRecordConfig): LightkurveRecordConfig {
  const text = (value: unknown, max = 10000) => typeof value === "string" && value.trim().length > 0 && value.length <= max
  if (!config || !Array.isArray(config.questions) || !config.questions.length || config.questions.length > 50 || !config.questions.every(question => text(question)) || !text(config.output)) throw new Error("Invalid Lightkurve learning questions")
  for (const questions of [config.quiz, config.exam ?? []]) {
    if (!Array.isArray(questions) || questions.length > 100) throw new Error("Invalid Lightkurve assessment")
    const ids = new Set<string>()
    for (const question of questions) {
      if (!question || !text(question.id, 100) || ids.has(question.id) || !text(question.question) || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 10 || !question.options.every(option => text(option, 2000)) || !Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length || !text(question.explanation)) throw new Error("Invalid Lightkurve assessment question")
      ids.add(question.id)
    }
  }
  if (config.response_prompts !== undefined) {
    if (!Array.isArray(config.response_prompts) || config.response_prompts.length > config.questions.length) throw new Error("Invalid Lightkurve response prompts")
    for (const prompt of config.response_prompts) {
      if (!prompt || !text(prompt.title) || !text(prompt.hint) || !text(prompt.example) || !Array.isArray(prompt.fields) || !prompt.fields.length || prompt.fields.length > 20) throw new Error("Invalid Lightkurve response prompt")
      const ids = new Set<string>()
      for (const field of prompt.fields) {
        if (!field || !text(field.id, 100) || ids.has(field.id) || !text(field.label) || !["choice", "short", "text"].includes(field.type) || (field.type === "choice" && (!Array.isArray(field.options) || !field.options.length || !field.options.every(option => text(option, 2000))))) throw new Error("Invalid Lightkurve response field")
        ids.add(field.id)
      }
    }
  }
  return config
}

export const lightkurveMediaUrl = (relative: string) => `/preview/lightkurve/media?path=${encodeURIComponent(relative)}`
