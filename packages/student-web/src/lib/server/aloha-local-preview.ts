import "server-only"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export const ALOHA_PREVIEW_SLUG = "aloha-bimanual-apprentice"
const sourceRoots = [process.env.SYSTEMEDU_IDEA_ROOT, path.resolve(process.cwd(), "../../../systemeduidea"), path.join(os.homedir(), "Dev/systemeduidea")].filter((root): root is string => !!root)
export const ALOHA_PREVIEW_ROOT = path.join(sourceRoots.find(root => existsSync(path.join(root, "projects_data", ALOHA_PREVIEW_SLUG, "manifest.json"))) || sourceRoots[0], "projects_data", ALOHA_PREVIEW_SLUG)

export function allowsLocalCoursePreview(host: string | null) {
  return process.env.NODE_ENV === "development" && !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
}

export async function alohaFilePath(relative: string) {
  if (!relative || path.isAbsolute(relative) || /[\\\u0000-\u001f]/.test(relative) || relative.split("/").some(part => !part || part === ".." || part === ".")) throw new Error("Invalid ALOHA path")
  const root = await fs.realpath(ALOHA_PREVIEW_ROOT)
  const resolved = await fs.realpath(path.join(root, relative))
  if (!resolved.startsWith(root + path.sep)) throw new Error("ALOHA file outside course directory")
  return resolved
}

export async function readAlohaPreviewJson(relative: string) {
  return JSON.parse(await readAlohaPreviewText(relative))
}

export async function readAlohaPreviewText(relative: string) {
  return fs.readFile(await alohaFilePath(relative), "utf8")
}
