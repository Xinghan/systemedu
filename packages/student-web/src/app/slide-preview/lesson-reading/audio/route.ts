import fs from "node:fs/promises"
import path from "node:path"

/** Only this existing demo node's nine narration files, development only. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 })
  const page = new URL(request.url).searchParams.get("page")
  if (!page || !/^[0-8]$/.test(page)) return new Response(null, { status: 404 })
  const file = path.resolve(process.cwd(), `../../../systemeduidea/projects_data/molecule-monster-hunter/knodes/M04-w0-module/audio/slide-${page}.wav`)
  try {
    const audio = await fs.readFile(file)
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } })
  } catch { return new Response(null, { status: 404 }) }
}
