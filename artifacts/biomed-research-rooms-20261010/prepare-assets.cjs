const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('../../packages/student-web/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),publicDir=path.join(root,'packages/student-web/public/mission/biomedicine/stations');
(async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(root,'tools/mission-authoring/biomed-research-room-prompts-v2.json'),'utf8'));
 const originalDir=path.join(__dirname,'originals');await fs.mkdir(originalDir,{recursive:true});const report=[];
 for(const station of manifest.stations){
  const original=path.join(originalDir,station.id+'.png');await fs.copyFile(station.source,original);
  const variants=[];
  for(const width of [640,960,1536]){const file=path.join(publicDir,`${station.id}-v2-${width}.webp`),height=width*9/16;
   await sharp(original).resize(width,height,{fit:'cover'}).webp({quality:83,effort:6}).toFile(file);
   const data=await fs.readFile(file),meta=await sharp(data).metadata();
   if(meta.width!==width||meta.height!==height)throw new Error('Invalid image dimensions');
   variants.push({path:path.relative(root,file),width,height,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
  report.push({station:station.id,original:path.relative(root,original),variants});
 }
 await fs.writeFile(path.join(__dirname,'assets.json'),JSON.stringify({generator:'built-in image_gen',passed:true,images:report},null,2)+'\n');
 console.log(JSON.stringify({rooms:report.length,variants:report.reduce((n,r)=>n+r.variants.length,0),totalBytes:report.flatMap(r=>r.variants).reduce((n,r)=>n+r.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1});
