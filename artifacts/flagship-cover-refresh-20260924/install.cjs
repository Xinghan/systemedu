const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('../../packages/student-web/node_modules/sharp');
const web = path.resolve(__dirname, '../..');
const source = '/Users/xinghan/Dev/systemeduidea';
const { entries } = JSON.parse(fs.readFileSync(path.join(__dirname, 'generation.json')));
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json')));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const records = [];
  for (const entry of entries) {
    const input = fs.readFileSync(entry.generatedPath);
    const meta = await sharp(input).metadata();
    if (meta.width !== 1536 || meta.height !== 1024) throw new Error(`Unexpected dimensions: ${entry.slug}`);
    const encoded = await sharp(input).webp({quality: 90, effort: 6}).toBuffer();
    const root = path.join(source, 'projects_data', entry.slug);
    const webRoot = path.join(web, 'packages/student-web/public/project-covers', entry.slug);
    fs.mkdirSync(webRoot, { recursive: true });
    fs.writeFileSync(path.join(root, 'cover-editorial-v3.png'), input);
    fs.writeFileSync(path.join(root, 'cover-editorial-v3.webp'), encoded);
    fs.writeFileSync(path.join(webRoot, 'cover-editorial-v3.webp'), encoded);
    const manifestPath = path.join(root, 'manifest.json');
    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    if (!/"cover_image_path":\s*"[^"]*"/.test(manifestText)) throw new Error(`Missing manifest cover: ${entry.slug}`);
    fs.writeFileSync(manifestPath, manifestText.replace(/"cover_image_path":\s*"[^"]*"/, '"cover_image_path": "cover-editorial-v3.webp"'));
    const record = {slug: entry.slug, tool: 'image_gen.imagegen', generatedAt: '2026-09-24', kind: 'AI-generated editorial illustration; not experimental evidence', prompt: prompts.entries.find(e => e.slug === entry.slug).prompt, original: 'cover-editorial-v3.png', served: 'cover-editorial-v3.webp', width: meta.width, height: meta.height, originalSha256: sha(input), servedSha256: sha(encoded), originalBytes: input.length, servedBytes: encoded.length, processing: 'WebP quality 90 encoding only; no image retouching or compositing.'};
    fs.writeFileSync(path.join(root, 'cover-editorial-v3.provenance.json'), JSON.stringify(record, null, 2) + '\n');
    records.push(record);
    console.log(entry.slug, meta.width + 'x' + meta.height, encoded.length + ' bytes');
  }
  const snapshotsPath = path.join(web, 'packages/student-web/src/lib/project-lines/course-snapshots.json');
  const snapshots = JSON.parse(fs.readFileSync(snapshotsPath));
  for (const project of snapshots) if (entries.some(e => e.slug === project.slug)) project.coverImage = `/project-covers/${project.slug}/cover-editorial-v3.webp`;
  fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'assets.json'), JSON.stringify(records.map(({prompt,...record})=>record), null, 2) + '\n');
})();
