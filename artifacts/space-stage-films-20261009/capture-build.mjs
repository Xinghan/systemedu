import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const folder=new URL('./stills/',import.meta.url).pathname;
await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:1.5});
 await context.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});
 const p=await context.newPage();
 await p.goto('http://localhost:4000/explore/space-exploration/assemble-a-rover?node=M06');
 await expect(p.getByRole('button',{name:'展开结构',exact:true})).toBeEnabled();
 await p.getByRole('button',{name:'展开结构',exact:true}).click();
 const canvas=p.locator('canvas[aria-label="当前尺寸的双电机探测车结构，可拖动旋转"]');
 await expect(canvas).toHaveCount(1);
 await canvas.evaluate(c=>{const parent=c.parentElement,figure=parent.parentElement;document.body.appendChild(figure);Object.assign(figure.style,{position:'fixed',left:'0',top:'0',width:'1280px',zIndex:'99999'});parent.style.width='1280px';parent.style.height='720px';c.style.width='100%';c.style.height='100%'});
 await expect.poll(()=>canvas.evaluate(c=>[c.clientWidth,c.clientHeight])).toEqual([1280,720]);
 await canvas.screenshot({path:folder+'printable-rover.png'});
} finally {await browser.close()}
