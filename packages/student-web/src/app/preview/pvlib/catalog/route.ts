import { allowsPvlibPreview, pvlibMediaUrl, readPvlibManifest } from "@/lib/server/pvlib-local-preview"
import type { PvlibLibraryPreview } from "@/lib/pvlib-library"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!allowsPvlibPreview(request.headers.get("host"))) return new Response(null, { status: 404 })
  try {
    const manifest = await readPvlibManifest()
    const first = [...manifest.knodes].sort((a, b) => a.module_id.localeCompare(b.module_id))[0]
    if (!manifest.files.some(file => file.path === `${first.knode_dir}/lesson.md`)) return new Response(null, { status: 404 })
    const cover = "authoring/images/cover-concept-v1.png"
    const preview: PvlibLibraryPreview = {
      title: manifest.title || "给阳光做一份发电预报",
      nodeCount: manifest.knodes.length,
      firstModuleId: first.module_id,
      coverHref: manifest.files.some(file => file.path === cover) ? pvlibMediaUrl(cover) : null,
    }
    return Response.json(preview, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return new Response(null, { status: 404 })
  }
}
