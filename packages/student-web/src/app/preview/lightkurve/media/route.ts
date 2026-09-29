import fs from "node:fs/promises"
import path from "node:path"
import { allowsLightkurvePreview, isLightkurveRelativePath, lightkurveFilePath, readLightkurveManifest } from "@/lib/server/lightkurve-local-preview"

export const dynamic = "force-dynamic"
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".zip": "application/zip", ".json": "application/json" }

export async function GET(request: Request) {
  if (!allowsLightkurvePreview(request.headers.get("host"))) return new Response(null, { status: 404 })
  const relative = new URL(request.url).searchParams.get("path") || ""
  const type = MIME[path.extname(relative).toLowerCase()]
  if (!type || !isLightkurveRelativePath(relative) || (type === "application/zip" && relative !== "downloads/lightkurve-practice-kit.zip")) return new Response(null, { status: 404 })
  if (type === "application/json" && relative !== "practice/browser/holdout.json") return new Response(null, { status: 404 })
  try {
    const manifest = await readLightkurveManifest()
    if (!manifest.files.some(file => file.path === relative)) return new Response(null, { status: 404 })
    const file = await lightkurveFilePath(relative)
    const data = await fs.readFile(file)
    return new Response(data, { headers: {
      "Content-Type": type, "Content-Length": String(data.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(type === "application/zip" ? { "Content-Disposition": 'attachment; filename="lightkurve-practice-kit.zip"' } : {}),
    } })
  } catch { return new Response(null, { status: 404 }) }
}
