import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'packages/student-web/package.json'))
const sharp = require('sharp')
const [slug, input] = process.argv.slice(2)
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '') || !input) {
  throw new Error('Usage: node scripts/generate-project-cover-variants.mjs <project-slug> <source-image>')
}
const source = await fs.readFile(input)
const digest = crypto.createHash('sha256').update(source).digest('hex')
const destination = path.join(root, 'packages/student-web/public/project-covers', slug)
const manifestPath = path.join(root, 'packages/student-web/src/lib/project-lines/project-cover-variants.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
await fs.mkdir(destination, { recursive: true })
const variants = []
for (const width of [480, 800, 1280]) {
  const { data, info } = await sharp(source).rotate().resize({ width, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 }).toBuffer({ resolveWithObject: true })
  const name = `cover-${digest.slice(0, 12)}-${width}.webp`
  await fs.writeFile(path.join(destination, name), data)
  if (!variants.some(item => item.width === info.width)) {
    variants.push({ src: `/project-covers/${slug}/${name}`, width: info.width, height: info.height, bytes: data.length })
  }
}
manifest[slug] = { source_sha256: digest, original_bytes: source.length, variants }
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ slug, ...manifest[slug] }, null, 2))
