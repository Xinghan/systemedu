import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = path.resolve(root, "../.."), out = path.join(root, "dist")
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true })
await build({ absWorkingDir: root, entryPoints: ["src/entry.tsx"], bundle: true, minify: true, format: "iife", target: ["safari17"], outfile: "dist/classroom.js", jsx: "automatic", loader: { ".woff2": "file", ".woff": "file", ".ttf": "file" }, legalComments: "eof", metafile: true }).then(async result => {
  await writeFile(path.join(out, "build-meta.json"), JSON.stringify(result.metafile, null, 2))
})
await writeFile(path.join(out, "index.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'self' systemedu:; script-src 'self' systemedu:; style-src 'self' systemedu: 'unsafe-inline'; img-src 'self' systemedu: data: blob: https:; connect-src 'self' systemedu:; media-src 'self' systemedu: https: blob:; font-src 'self' systemedu: data:; object-src 'none'; frame-src 'self' systemedu:; base-uri 'none'"><title>SystemEdu 课堂</title><link rel="stylesheet" href="classroom.css"></head><body><div id="root" role="main">正在打开课堂…</div><script src="classroom.js"></script></body></html>`)
const files = []
for (const lab of ["mechanical-hand", "mars-landing"]) {
  for (const file of [`${lab}.glb`, "poster.png", "manifest.json"]) {
    const source = `packages/student-web/public/${lab}/${file}`, destination = `${lab}/${file}`
    const bytes = await readFile(path.join(repo, source))
    await mkdir(path.join(out, lab), { recursive: true }); await cp(path.join(repo, source), path.join(out, destination))
    files.push({ path: destination, source, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") })
  }
}
await writeFile(path.join(out, "asset-provenance.json"), JSON.stringify({ schema_version: 1, files }, null, 2))
const licenses = []
const pkg = JSON.parse(await readFile(path.join(root, "package.json")))
for (const name of Object.keys(pkg.dependencies)) {
  const dir = path.join(root, "node_modules", name), meta = JSON.parse(await readFile(path.join(dir, "package.json")))
  let text = ""
  for (const file of ["LICENSE", "LICENSE.md", "license", "license.md", "LICENSE.txt"]) { try { text = await readFile(path.join(dir, file), "utf8"); break } catch {} }
  if (!text && ["rehype-katex","remark-math"].includes(name)) text = await readFile(path.join(root,"licenses/remark-math-MIT.txt"),"utf8")
  if (!text) throw new Error(`Missing license text for ${name}`)
  licenses.push(`${name} ${meta.version}\n${text}`)
}
await writeFile(path.join(out, "THIRD_PARTY_NOTICES.txt"), licenses.join("\n\n---\n\n"))
console.log(`Built local classroom: ${out}`)

execFileSync("python3", [path.join(root, "scripts/export-content.py")], {stdio: "inherit"})

execFileSync(process.execPath, [path.join(root, "scripts/build-embedded.mjs")], {stdio: "inherit"})
await cp(path.join(root, "embedded/content-frame.js"), path.join(out, "content-frame.js"))
await cp(path.join(root, "embedded/ipad-observatory.css"), path.join(out, "ipad-observatory.css"))
