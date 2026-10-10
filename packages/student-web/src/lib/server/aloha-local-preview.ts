import "server-only"
import fs from "node:fs/promises"
import path from "node:path"

export const ALOHA_PREVIEW_SLUG = "aloha-bimanual-apprentice"
export const ALOHA_PREVIEW_ROOT = path.resolve(process.cwd(), "../../../systemeduidea/projects_data", ALOHA_PREVIEW_SLUG)

export function allowsLocalCoursePreview(host: string | null) {
  if (process.env.NODE_ENV !== "development" || !host) return false
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname) }
  catch { return false }
}

export async function readAlohaPreviewJson(relative: string) {
  return JSON.parse(await fs.readFile(path.join(ALOHA_PREVIEW_ROOT, relative), "utf8"))
}

export async function readAlohaPreviewText(relative: string) {
  return fs.readFile(path.join(ALOHA_PREVIEW_ROOT, relative), "utf8")
}
