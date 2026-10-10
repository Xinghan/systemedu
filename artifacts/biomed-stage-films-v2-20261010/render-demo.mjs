// Deterministic teaching sequences, not experiment footage or a new student UI.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const here=new URL('./',import.meta.url).pathname;
const root=new URL('../../',import.meta.url).pathname;
const scripts=JSON.parse(await fs.readFile(here+'scripts.json'));
const data=JSON.parse(await fs.readFile(root+'packages/student-web/src/lib/project-lines/biomed-data.json'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
await page.setContent('<canvas width="1920" height="1080"></canvas>');
await page.addScriptTag({path:here+'visuals.js'});
try {
 for(const item of scripts){
  if(process.argv[2]&&item.level!==Number(process.argv[2]))continue;
  const folder=here+`stage-${item.level}/`;
  const audio=JSON.parse(await fs.readFile(folder+'audio.json'));
  const lengths=audio.step_seconds.map(s=>s+.8),duration=lengths.reduce((a,b)=>a+b,0);
  const background=await fs.readFile(root+`packages/student-web/public/mission/biomedicine/stations/${item.station}-v2-1536.webp`);
  await page.evaluate(async args=>{
   window.item=args.item;window.lengths=args.lengths;window.model=args.model;
   window.background=new Image();background.src=args.image;await background.decode();
  },{item,lengths,model:data.models.find(m=>m.id==='caffeine'),image:'data:image/webp;base64,'+background.toString('base64')});
  const encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',folder+'demo.mp4'],{stdio:['pipe','ignore','inherit']});
  const completed=once(encoder,'close');encoder.stdin.on('error',()=>{});
  const frames=Math.ceil(duration*24);
  for(let f=0;f<frames;f++){
   const image=await page.evaluate(t=>{draw(t);return document.querySelector('canvas').toDataURL('image/jpeg',.92).split(',')[1]},f/24);
   const bytes=Buffer.from(image,'base64');
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');
   if(f===48||lengths.slice(0,-1).some((_,i)=>f===Math.round((lengths.slice(0,i+1).reduce((a,b)=>a+b,0)+2)*24)))await fs.writeFile(folder+`demo-${f}.jpg`,bytes);
  }
  encoder.stdin.end();const [status]=await completed;if(status!==0)throw new Error('Demo encode failed');
  await fs.writeFile(folder+'demo-timing.json',JSON.stringify({fps:24,frames,duration,lengths},null,2)+'\n');
  console.log(JSON.stringify({station:item.station,rendered:true,frames,duration}));
 }
}finally{await browser.close()}
