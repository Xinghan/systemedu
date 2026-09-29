import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { allowsTeachOpenCADDPreview, readTeachOpenCADDManifest } from "@/lib/server/teachopencadd-local-preview"
import { teachopencaddHref, teachopencaddView } from "@/lib/teachopencadd-preview"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!allowsTeachOpenCADDPreview((await headers()).get("host"))) notFound()
  const [manifest, search] = await Promise.all([readTeachOpenCADDManifest(), searchParams])
  redirect(teachopencaddHref(manifest.knodes[0].module_id, teachopencaddView(search.view), search.mode === "animation" ? "animation" : "game"))
}
