// Convert generated images to responsive WebP; no compositing or content changes.
const sharp = require('../../packages/student-web/node_modules/sharp');
const fs = require('node:fs/promises'), path = require('node:path');
(async () => {
  const sources = JSON.parse(await fs.readFile(path.join(__dirname, 'sources.json'), 'utf8'));
  const root = path.resolve(__dirname, '../..'), files = [];
  for (const [id, source] of Object.entries(sources)) {
    const metadata = await sharp(source).metadata();
    for (const [width, quality] of [[1536, 84], [960, 82], [640, 80]]) {
      const file = `packages/student-web/public/mission/space/stations/${id}-v1-${width}.webp`;
      const info = await sharp(source).resize({width, withoutEnlargement: true}).webp({quality, effort: 6}).toFile(path.join(root, file));
      files.push({id, file, width: info.width, height: info.height, bytes: info.size, originalDimensions: [metadata.width, metadata.height]});
    }
  }
  await fs.writeFile(path.join(__dirname, 'image-assets.json'), JSON.stringify({tool:'built-in image_gen', promptFile:'prompts.json', files}, null, 2)+'\n');
  console.log(JSON.stringify({images: files.length, bytes: files.reduce((n,f)=>n+f.bytes,0), largest: Math.max(...files.map(f=>f.bytes))}));
})();
