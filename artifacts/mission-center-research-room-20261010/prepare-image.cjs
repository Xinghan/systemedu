// Format/size preparation only: preserve generated composition and content.
const sharp=require('../../packages/student-web/node_modules/sharp');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const source=process.argv[2];if(!source)throw new Error('Pass the generated image source path');
 const root=path.resolve(__dirname,'../..'),out=root+'/packages/student-web/public/mission/space';
 const metadata=await sharp(source).metadata(),files=[];
 for(const [width,quality] of [[1536,85],[960,83],[640,81]]){
  const file=`research-control-room-v1-${width}.webp`;
  const info=await sharp(source).resize({width,withoutEnlargement:true}).webp({quality,effort:6}).toFile(path.join(out,file));
  files.push({file,width:info.width,height:info.height,bytes:info.size});
 }
 await fs.writeFile(path.join(__dirname,'image-assets.json'),JSON.stringify({tool:'built-in image_gen',originalDimensions:[metadata.width,metadata.height],sourceFile:path.basename(source),promptFile:'image-prompt.txt',files},null,2)+'\n');
 console.log(JSON.stringify(files));
})();
