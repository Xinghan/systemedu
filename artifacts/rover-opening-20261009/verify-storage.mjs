import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results={checks:[],passed:false};
const token=`test.${Buffer.from(JSON.stringify({sub:'rover-ui-fixture'})).toString('base64url')}.not-a-real-token`;
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(t=>localStorage.setItem('systemedu_token',t),token);
 let draft=null, writes=0, fail=false, unexpected=0;
 await ctx.route('**/api/learning/**',async route=>{
   const r=route.request(), url=new URL(r.url());
   if(fail){await route.fulfill({status:503,json:{message:'测试：服务暂不可用'}});return}
   if(url.pathname.endsWith('/records')) await route.fulfill({json:{draft,submissions:[]}});
   else if(url.pathname.endsWith('/drafts')){
     const b=r.postDataJSON();expect(b.module_id).toBe('OPENING');expect(b.activity_id).toBe('first-person-mission');expect(b.expected_revision).toBe(draft?.revision??0);
     expect(r.headers()['authorization']).toBe(`Bearer ${token}`);
     writes++;draft={id:'test-record',body:b.body,revision:(draft?.revision??0)+1,status:'draft',updated_at:new Date().toISOString()};
     await route.fulfill({json:{draft}});
   }else{unexpected++;await route.fulfill({status:400,json:{}})}
 });
 const p=await ctx.newPage();p.setDefaultTimeout(12000);
 await p.goto('http://localhost:4000/mission/rover');await p.getByRole('button',{name:'静音进入 · 保留字幕'}).click();await p.getByRole('button',{name:'跳过简报'}).click();
 await p.getByRole('button',{name:'观察松软沙地',exact:true}).click();
 await expect.poll(()=>draft?.body.artifact.observed.includes('sand')).toBe(true);
 await p.reload();await p.getByRole('button',{name:'继续我的任务'}).click();
 await expect(p.getByRole('button',{name:'已观察 1 / 3'})).toBeVisible();results.checks.push('Mock API: authenticated draft writes correct scope/revision and restores after reload');
 fail=true;await p.getByRole('button',{name:'观察连续岩面',exact:true}).click();await p.waitForTimeout(900);
 await p.getByRole('button',{name:'查看保存状态'}).click();await expect(p.getByRole('dialog')).toContainText('服务暂不可用');
 await p.keyboard.press('Escape');await expect(p.getByRole('dialog')).toHaveCount(0);
 results.checks.push('Mock API: failed save is surfaced, Escape dismisses native modal');
 fail=false;await p.getByRole('button',{name:'查看保存状态'}).click();await p.getByRole('button',{name:'重试同步'}).click();await expect.poll(()=>draft?.body.artifact.observed.length).toBe(2);
 expect(unexpected).toBe(0);results.checks.push('Retry preserves edits; no submission/course-completion endpoint is called');
 await ctx.close();
 const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Disabled','QuotaExceededError')}});
 const b=await blocked.newPage();await b.goto('http://localhost:4000/mission/rover');await b.getByRole('button',{name:'静音进入 · 保留字幕'}).click();await b.getByRole('button',{name:'跳过简报'}).click();await b.getByRole('button',{name:'观察松软沙地',exact:true}).click();await b.getByRole('button',{name:'查看保存状态'}).click();await expect(b.getByRole('dialog')).toContainText('当前内容只在页面中');await blocked.close();results.checks.push('Blocked local storage does not claim persistence; manual backup stays available');
 results.passed=true;results.writes=writes;
}catch(e){results.error=String(e);throw e}finally{await fs.writeFile(new URL('./storage-verification.json',import.meta.url),JSON.stringify(results,null,2));await browser.close()}
