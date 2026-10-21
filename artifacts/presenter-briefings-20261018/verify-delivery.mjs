import {createRequire} from 'node:module';const {chromium,expect}=createRequire(import.meta.url)('@playwright/test');
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://127.0.0.1:4020',items=JSON.parse(await fs.readFile(dir+'scripts.json'));
const browser=await chromium.launch({headless:true});const ctx=await browser.newContext();const p=await ctx.newPage();const report={passed:false,films:[]};
try{
 for(const f of items){
  const route=`/mission/${f.line}/video/${f.station}-v2.mp4`;
  const expected=await fs.stat('packages/student-web/public'+route);
  const res=await ctx.request.get(origin+route,{headers:{Range:'bytes=0-2047'}});
  expect(res.status()).toBe(206);expect(res.headers()['content-type']).toContain('video/mp4');expect(res.headers()['content-range']).toBe(`bytes 0-2047/${expected.size}`);
  const head=await res.body();expect(head.includes(Buffer.from('ftyp'))).toBe(true);expect(head.includes(Buffer.from('moov'))).toBe(true);
  const caption=await ctx.request.get(origin+route.replace('-v2.mp4','-zh-v2.vtt'));expect(caption.status()).toBe(200);expect(await caption.text()).toContain('WEBVTT');
  const actual=await p.evaluate(async url=>{
   const v=document.createElement('video');v.muted=true;v.preload='metadata';document.body.append(v);
   const event=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video decode timeout: '+name)),15000);v.addEventListener(name,()=>{clearTimeout(timer);resolve()},{once:true});v.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Video error '+v.error?.code))},{once:true})});
   const loaded=event('loadedmetadata');v.src=url;await loaded;
   const duration=v.duration;const sought=event('seeked');v.currentTime=duration-.5;await sought;
   const value={duration,width:v.videoWidth,height:v.videoHeight,decodedEnd:!v.error};v.removeAttribute('src');v.load();v.remove();return value;
  },origin+route);
  expect(actual.width).toBe(1920);expect(actual.height).toBe(1080);expect(actual.decodedEnd).toBe(true);
  report.films.push({line:f.line,station:f.station,range:true,fastStart:true,...actual});
 }
 report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'delivery-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
