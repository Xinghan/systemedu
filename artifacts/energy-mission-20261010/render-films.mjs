import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../package.json',import.meta.url))('@playwright/test');
import fs from 'node:fs/promises';import {spawn} from 'node:child_process';import {once} from 'node:events';
const here=new URL('./',import.meta.url).pathname,root=new URL('../../',import.meta.url).pathname;
const items=JSON.parse(await fs.readFile(here+'scripts.json'));const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.setContent('<canvas width="1920" height="1080"></canvas>');await page.addScriptTag({path:here+'visuals.js'});
for(const item of items){if(process.argv[2]&&item.level!==Number(process.argv[2]))continue;const folder=here+`stage-${item.level}/`;const audio=JSON.parse(await fs.readFile(folder+'audio.json'));const image=await fs.readFile(root+`packages/student-web/public/mission/energy/stations/${item.station}-v1-1536.webp`);
await page.evaluate(async args=>{window.item=args.item;window.lengths=args.lengths;window.background=new Image();background.src=args.image;await background.decode();},{item,lengths:audio.lengths,image:'data:image/webp;base64,'+image.toString('base64')});
const seconds=audio.lengths.reduce((a,b)=>a+b,0),frames=Math.ceil(seconds*24);const encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',folder+'silent.mp4'],{stdio:['pipe','ignore','inherit']});const completed=once(encoder,'close');encoder.stdin.on('error',()=>{});
const samples=[2,...audio.lengths.slice(0,-1).map((_,i)=>audio.lengths.slice(0,i+1).reduce((a,b)=>a+b,0)+2)].map(t=>Math.round(t*24));
for(let f=0;f<frames;f++){const b=Buffer.from(await page.evaluate(t=>{draw(t);return document.querySelector('canvas').toDataURL('image/jpeg',.88).split(',')[1]},f/24),'base64');if(!encoder.stdin.write(b))await once(encoder.stdin,'drain');if(samples.includes(f))await fs.writeFile(folder+`frame-${samples.indexOf(f)}.jpg`,b);}
encoder.stdin.end();const [code]=await completed;if(code!==0)throw Error('encoder failed');console.log(JSON.stringify({station:item.station,seconds,frames}));}
}finally{await browser.close();}
