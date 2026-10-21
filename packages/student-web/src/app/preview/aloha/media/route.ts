import fs from "node:fs/promises"
import path from "node:path"
import { allowsLocalCoursePreview, alohaFilePath, readAlohaPreviewJson } from "@/lib/server/aloha-local-preview"

export const dynamic = "force-dynamic"
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" }
export async function GET(request: Request) {
  if (!allowsLocalCoursePreview(request.headers.get("host"))) return new Response(null, { status: 404 })
  const relative = new URL(request.url).searchParams.get("path") || ""
  const type = MIME[path.extname(relative).toLowerCase()]
  if (!type) return new Response(null, { status: 404 })
  try {
    const manifest = await readAlohaPreviewJson("manifest.json")
    if (!manifest.files.some((file: { path: string }) => file.path === relative)) return new Response(null, { status: 404 })
    const data = await fs.readFile(await alohaFilePath(relative))
    return new Response(data, { headers: { "Content-Type": type, "Content-Length": String(data.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } })
  } catch { return new Response(null, { status: 404 }) }
}
