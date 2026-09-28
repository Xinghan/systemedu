import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { allowsPvlibPreview, readPvlibManifest } from "@/lib/server/pvlib-local-preview"
import { pvlibHref, pvlibLabMode, pvlibView } from "@/lib/pvlib-preview"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!allowsPvlibPreview((await headers()).get("host"))) notFound()
  const [manifest, search] = await Promise.all([readPvlibManifest(), searchParams])
  redirect(pvlibHref(manifest.knodes[0].module_id, pvlibView(search.view), pvlibLabMode(search.mode)))
}
