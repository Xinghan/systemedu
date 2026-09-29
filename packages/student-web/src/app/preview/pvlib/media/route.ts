import fs from "node:fs/promises"
import path from "node:path"
import { allowsPvlibPreview, isPvlibRelativePath, pvlibFilePath, readPvlibManifest } from "@/lib/server/pvlib-local-preview"

export const dynamic = "force-dynamic"
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".zip": "application/zip" }

export async function GET(request: Request) {
  if (!allowsPvlibPreview(request.headers.get("host"))) return new Response(null, { status: 404 })
  const relative = new URL(request.url).searchParams.get("path") || ""
  const type = MIME[path.extname(relative).toLowerCase()]
  if (!type || !isPvlibRelativePath(relative) || (type === "application/zip" && relative !== "downloads/pvlib-practice-kit.zip")) return new Response(null, { status: 404 })
  try {
    const manifest = await readPvlibManifest()
    if (!manifest.files.some(file => file.path === relative)) return new Response(null, { status: 404 })
    const file = await pvlibFilePath(relative)
    const data = await fs.readFile(file)
    return new Response(data, { headers: {
      "Content-Type": type, "Content-Length": String(data.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(type === "application/zip" ? { "Content-Disposition": 'attachment; filename="pvlib-practice-kit.zip"' } : {}),
    } })
  } catch { return new Response(null, { status: 404 }) }
}
