import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const bg='#0c1927',fg='#edf2f6',muted='#a8becd',gold='#ffc473',teal='#8ee1d3';
const t=(x,y,s,size=30,color=fg,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const line=(x,y,x2,y2,c=muted,width=2)=>`<path d="M${x},${y}L${x2},${y2}" fill="none" stroke="${c}" stroke-width="${width}"/>`;
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760"><rect width="1400" height="760" rx="28" fill="${bg}"/><g font-family="PingFang SC, sans-serif">${body}</g></svg>`;
const drawings={
 'beginner-observation':wrap(
  t(64,74,'都是恒星，能分辨的细节却不同',42)+t(64,121,'观察方式示意 · 不按距离或大小比例绘制',24,muted)+
  line(700,180,700,670,'#294353')+t(345,217,'太阳',36,gold,'middle')+t(1040,217,'Kepler-10',36,teal,'middle')+
  circle(345,380,114,gold)+circle(309,359,13,'#ad692d')+circle(379,408,20,'#ad692d')+circle(387,396,7,'#704121')+
  circle(1040,380,24,'#1c3d4d')+circle(1040,380,9,fg)+
  t(345,564,'专用太阳仪器可以分辨圆面',28,fg,'middle')+t(345,610,'比较不同位置的表面区域',27,muted,'middle')+
  t(1040,564,'本课不能拍清星面与旁边行星',28,fg,'middle')+t(1040,610,'记录每个时刻收到的光量',27,muted,'middle')+
  t(64,716,'使用已有图像学习；不要直接用眼睛或普通望远镜看太阳。',25,gold)),
 'beginner-transit':wrap(
  t(64,74,'凌星：挡住的是通向观察者的一部分光',40)+t(64,122,'观察者方向固定 · 上方为视线投影示意，黑色圆是行星',25,muted)+
  [270,700,1130].map((x,i)=>circle(x,290,71,gold)+`<circle cx="${x+[-110,0,110][i]}" cy="290" r="14" fill="${bg}" stroke="#7892a4" stroke-width="2"/>`+t(x,402,['经过前','经过中','经过后'][i],28,fg,'middle')).join('')+
  t(64,458,'模拟读数',25,muted)+line(165,495,165,655)+line(165,655,1240,655)+
  line(165,500,1240,500,'#294353')+line(165,610,1240,610,'#294353')+
  t(145,510,'100',24,fg,'end')+t(145,620,'96',24,fg,'end')+
  [270,700,1130].map((x,i)=>circle(x,[500,610,500][i],8,teal)+t(x,692,`${i} 秒`,24,fg,'middle')).join('')+
  t(64,737,'构造教学例：下降幅度被放大；这不是 Kepler-10 的实测光变曲线。',24,gold)),
 'beginner-points':wrap(
  t(64,74,'表里的一行，对应图上的一个点',42)+t(64,122,'构造教学例 · 模拟亮度单位只在此练习中使用',25,muted)+
  t(70,240,'时间（小时）',26)+t(300,240,'读数',26,fg,'middle')+
  [0,1,2,3,4].map((x,i)=>t(150,310+i*65,String(x),28,i===2?gold:fg,'middle')+t(300,310+i*65,String([100,100,98,100,100][i]),28,i===2?gold:fg,'middle')).join('')+
  t(520,240,'模拟读数',25,muted)+line(420,200,420,640,'#294353')+
  [97,98,99,100,101].map(v=>line(530,610-(v-97)*65,1280,610-(v-97)*65,'#294353')+t(510,620-(v-97)*65,String(v),24,fg,'end')).join('')+
  line(530,330,530,610)+line(530,610,1280,610)+
  [0,1,2,3,4].map((v,i)=>circle(600+i*150,610-([100,100,98,100,100][i]-97)*65,9,i===2?gold:teal)+t(600+i*150,654,String(v),24,fg,'middle')).join('')+
  t(920,510,'第2小时，读数98',26,gold)+t(1280,710,'时间（小时）',25,muted,'end')+t(64,710,'纵轴只显示97—101，放大显示这段变化。',24,muted))
};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:760},deviceScaleFactor:1});
for(const [name,svg] of Object.entries(drawings)){
 await writeFile(dir+name+'.svg',svg);
 await page.setContent(`<style>body{margin:0;background:${bg}}</style>${svg}`);
 await page.evaluate(()=>document.fonts.ready);
 const clipped=await page.locator('text').evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBBox();return b.x<0||b.y<0||b.x+b.width>1400||b.y+b.height>760}).map(n=>n.textContent));
 if(clipped.length)throw new Error(name+': '+clipped.join(','));
 await page.screenshot({path:dir+name+'.png'});
 console.log(name,'rendered, no clipped text');
}
await browser.close();
