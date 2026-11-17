import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, readFile, appendFile } from 'node:fs/promises'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), web=path.resolve(root,'../student-web')
const result = await build({metafile:true,legalComments:'eof',absWorkingDir:root, entryPoints:['embedded/entry.tsx'],bundle:true,minify:true,format:'iife',target:['safari17'],outfile:'dist/embedded.js',jsx:'automatic',loader:{'.woff2':'file','.woff':'file','.ttf':'file','.png':'file'},external:['/mission/*','/project-lines/*'],alias:{'three/addons':path.join(root,'node_modules/three/examples/jsm'),'@':path.join(web,'src'),'next/link':path.join(root,'embedded/next-link.tsx'),'next/image':path.join(root,'embedded/next-image.tsx'),'next/navigation':path.join(root,'embedded/navigation.ts'),'@/lib/auth':path.join(root,'embedded/auth.ts'),'@/lib/stores/auth-store':path.join(root,'embedded/auth-store.ts'),'react':path.join(root,'node_modules/react'),'react-dom':path.join(root,'node_modules/react-dom'),'three':path.join(root,'node_modules/three')}, define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_STUDENT_API_URL':'"https://systeme.xin"'},logLimit:8})
await writeFile(path.join(root,'dist/embedded.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/embedded.css"><script src="/content-frame.js"></script><body><div id="root"></div><script src="/embedded.js"></script></body></html>')

// Include licenses for packages pulled in by shared website renderers as well.
const seen = new Set(), notices = []
for (const input of Object.keys(result.metafile.inputs)) {
  const absolute=path.resolve(root,input), marker=absolute.lastIndexOf('/node_modules/')
  if(marker<0) continue
  const segments=absolute.slice(marker+14).split('/'), name=segments[0].startsWith('@') ? segments.slice(0,2).join('/') : segments[0]
  const directory=absolute.slice(0,marker+14)+name
  if(seen.has(directory)) continue; seen.add(directory)
  const meta=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'))
  let license=''
  for(const file of ['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','COPYING','COPYRIGHT']) {try {license=await readFile(path.join(directory,file),'utf8');break} catch {}}
  if(!license && ['remark-math','rehype-katex'].includes(name)) license=await readFile(path.join(root,'licenses/remark-math-MIT.txt'),'utf8')
  notices.push(`${name} ${meta.version} — ${meta.license ?? 'see package'}\n${license || JSON.stringify({author:meta.author,repository:meta.repository})}`)
}
await appendFile(path.join(root,'dist/THIRD_PARTY_NOTICES.txt'),'\n\nShared classroom renderers\n\n'+notices.join('\n\n---\n\n'))
