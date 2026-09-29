import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { allowsLightkurvePreview, readLightkurveManifest } from "@/lib/server/lightkurve-local-preview"
import { lightkurveHref, lightkurveView } from "@/lib/lightkurve-preview"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!allowsLightkurvePreview((await headers()).get("host"))) notFound()
  const [manifest, search] = await Promise.all([readLightkurveManifest(), searchParams])
  redirect(lightkurveHref(manifest.knodes[0].module_id, lightkurveView(search.view), search.mode === "animation" ? "animation" : "game"))
}
