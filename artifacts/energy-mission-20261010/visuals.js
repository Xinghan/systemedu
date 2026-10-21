/* Authored procedural figures for mission films; all plotted samples are labelled demonstrations. */
const ctx=document.querySelector('canvas').getContext('2d');
const ink='#ecf1ed',dim='#9cafb4',gold='#f0c67e',teal='#75d6cb',red='#ef9b80';
function box(x,y,w,h,fill='#101f2aea',stroke='#60717c',r=16){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}}
function txt(s,x,y,size=28,color=ink,font='sans-serif'){ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.fillText(s,x,y);}
function wrap(s,x,y,width,size=30,color=ink,line=48){ctx.fillStyle=color;ctx.font=`${size}px sans-serif`;let row='';for(const c of s){if(ctx.measureText(row+c).width>width){if(/[，。；：！？、）】]/.test(c)){ctx.fillText(row+c,x,y);row='';}else{ctx.fillText(row,x,y);row=c;}y+=line;}else row+=c;}ctx.fillText(row,x,y);return y;}
function line(x,y,X,Y,color=teal,width=3){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function dot(x,y,r=7,color=teal){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function arrow(x,y,X,Y,color=teal){line(x,y,X,Y,color,3);const a=Math.atan2(Y-y,X-x);line(X,Y,X-13*Math.cos(a-.5),Y-13*Math.sin(a-.5),color,3);line(X,Y,X-13*Math.cos(a+.5),Y-13*Math.sin(a+.5),color,3);}
function grid(x,y,w,h){for(let i=0;i<=5;i++){line(x,y+i*h/5,x+w,y+i*h/5,'#3d4f593d',1);line(x+i*w/5,y,x+i*w/5,y+h,'#3d4f593d',1);}line(x,y+h,x+w,y+h,dim,1);line(x,y,x,y+h,dim,1);}
function curve(fn,x,y,w,h,p,color=teal){ctx.beginPath();for(let i=0;i<=160*p;i++){let q=i/160,X=x+q*w,Y=y+h-h*fn(q);i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();}
function solar(cx,cy,angle){ctx.save();ctx.translate(cx,cy);line(0,15,0,145,dim,13);box(-125,136,250,18,'#445762',null,5);ctx.rotate(angle);box(-155,-102,310,204,'#173954','#aec2ce',7);for(let a=0;a<6;a++)for(let b=0;b<4;b++){box(-145+a*49,-92+b*47,44,41,'#245077','#6c91ae',2);line(-142+a*49,-78+b*47,-105+a*49,-78+b*47,'#8ca5b1',1);line(-142+a*49,-65+b*47,-105+a*49,-65+b*47,'#6c849c',1);}for(const x of [-147,147])for(const y of [-94,94])dot(x,y,3,'#d4dbda');ctx.restore();}
function rotor(cx,cy,t){line(cx,cy,cx,cy+160,dim,12);box(cx-110,cy+150,220,16,'#435763',null,5);ctx.save();ctx.translate(cx,cy);ctx.rotate(t);for(let j=0;j<3;j++){ctx.rotate(2*Math.PI/3);ctx.beginPath();ctx.moveTo(-12,0);ctx.bezierCurveTo(-50,-45,-26,-150,-4,-170);ctx.bezierCurveTo(14,-110,35,-30,12,0);ctx.fillStyle='#95adb5';ctx.fill();ctx.strokeStyle='#dde6e1';ctx.lineWidth=2;ctx.stroke();}ctx.restore();ctx.beginPath();ctx.arc(cx,cy,183,0,Math.PI*2);ctx.strokeStyle='#8096a0';ctx.lineWidth=2;ctx.stroke();dot(cx,cy,23,'#455a68');dot(cx,cy,9,gold);}
function chip(x,y,label,color=teal,width=200){box(x,y,width,75,'#152936',color,9);txt(label,x+20,y+48,25,color);}
function pathFlow(points,t,color=teal){for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],color,3);for(let k=0;k<5;k++){let f=((t*.22+k/5)%1)*(points.length-1),i=Math.floor(f),a=points[i],b=points[Math.min(i+1,points.length-1)];dot(a[0]+(b[0]-a[0])*(f-i),a[1]+(b[1]-a[1])*(f-i),5,color);}}
function scene(id,step,t,p){
 const x=830,y=350,w=940,h=405;txt('操作演示 / 非实测数据',x,y-38,22,dim);
 if(id==='discovery'){
  solar(x+260,y+185,(-.32+.22*Math.sin(t*.5)));dot(x+715,y+35,40,gold);for(let j=0;j<5;j++)arrow(x+665,y+45+j*20,x+410,y+140+j*20,gold);
  box(x+610,y+190,300,190);txt('相同负载',x+640,y+230,24,dim);txt(step===1?'只改变面板角度':step===2?'保留两次结果':'保存自己的比较',x+640,y+275,26,gold);
  for(let i=0;i<2;i++){txt(i?'B':'A',x+640,y+322+i*30,20);box(x+680,y+303+i*30,(i?170:110)*(Math.min(1,p*3)),18,i?teal:gold,null,3);}txt('A 与 B：同一组测试条件',x+70,y+440,27,dim);
 }else if(id==='harvest'){
  solar(x+200,y+175,.1);rotor(x+705,y+185,t*1.4);txt('固定光照 · 固定负载',x+25,y+405,26,gold);txt('固定风况 · 固定负载',x+525,y+405,26,teal);
  for(let j=0;j<3;j++)dot(x+460,y+130+j*75,step===j+1?10:4,step===j+1?gold:dim);
 }else if(id==='storage'){
  chip(x,y+40,'输入功率');chip(x+350,y+40,'可用储能');chip(x+710,y+40,'关键负载',gold,230);
  pathFlow([[x+200,y+78],[x+350,y+78]],t);pathFlow([[x+550,y+78],[x+710,y+78]],t,gold);
  grid(x+45,y+195,845,215);curve(q=>.75-.48*q+.05*Math.sin(q*17),x+45,y+195,845,215,p,teal);
  line(x+45,y+195+215*.55,x+890,y+195+215*.55,gold,2);line(x+45,y+195+215*.35,x+890,y+195+215*.35,dim,2);
  txt('恢复阈值',x+640,y+260,21,dim);txt('暂停阈值',x+640,y+318,21,gold);txt(step===3?'读数缺失 → 执行预先约定的策略':'给两个阈值留出间距，避免反复开关',x+45,y+465,26,ink);
 }else if(id==='integration'){
  const nodes=[[x,y+30,'光伏'],[x,y+205,'风轮'],[x+335,y+115,'储能'],[x+685,y+30,'采集'],[x+685,y+205,'关键负载']];nodes.forEach(([X,Y,n],i)=>chip(X,Y,n,i===3&&step===2?red:teal,235));
  pathFlow([[x+235,y+67],[x+270,y+67],[x+270,y+152],[x+335,y+152]],t);pathFlow([[x+235,y+242],[x+270,y+242],[x+270,y+152]],t);pathFlow([[x+570,y+152],[x+620,y+152],[x+620,y+67],[x+685,y+67]],t,step===2?red:teal);pathFlow([[x+620,y+152],[x+620,y+242],[x+685,y+242]],t,gold);
  box(x+25,y+355,890,95);txt(step===1?'结构 / 电气 / 数据：分别核对接口':step===2?'诊断：发送 mV，接收端是否误当作 V？':'封存规则 → 新工况 → 保留首次结果',x+55,y+413,30,step===2?red:gold);
 }else if(id==='measurement'){
  grid(x+40,y+50,820,315);curve(q=>Math.max(0,1-Math.pow(q,7))*.85,x+40,y+50,820,315,p,teal);curve(q=>q*(1-Math.pow(q,7))*1.15,x+40,y+50,820,315,p,gold);
  for(let i=0;i<13*p;i++){const q=i/12;dot(x+40+q*820,y+365-315*.85*(1-Math.pow(q,7)),5,teal);}
  txt('负载扫描 / 电压',x+610,y+407,26,dim);txt('电流趋势',x+65,y+93,24,teal);txt('功率趋势',x+65,y+132,24,gold);txt(step===1?'同一负载，同一时刻：P = V × I':step===2?'打印支架：拆下 → 装回 → 复测姿态':'保留时间、单位、校准与缺失标记',x+40,y+470,28,ink);
 }else if(id==='forecast'){
  ['太阳位置','板面辐照','温度关系','直流功率'].forEach((label,i)=>{chip(x+5+i*233,y+40,label,i<=step?teal:dim,195);if(i<3)arrow(x+203+i*233,y+78,x+234+i*233,y+78,i<step?gold:dim);});
  grid(x+40,y+185,820,245);curve(q=>Math.max(0,Math.sin(q*Math.PI))*.84,x+40,y+185,820,245,p,gold);curve(q=>Math.max(0,Math.sin(q*Math.PI))*.71,x+40,y+185,820,245,p,teal);txt('每一段都写清输入、单位、假设与版本',x+40,y+480,28,ink);
 }else if(id==='validation'){
  chip(x+10,y+30,'发布预报',gold,245);chip(x+350,y+30,'未来时刻',dim,245);chip(x+690,y+30,'独立观测',teal,245);arrow(x+260,y+65,x+342,y+65,gold);arrow(x+600,y+65,x+684,y+65,teal);
  grid(x+45,y+170,845,250);curve(q=>.4+.25*Math.sin(q*6.28),x+45,y+170,845,250,1,gold);curve(q=>.46+.18*Math.sin(q*5.8+.3),x+45,y+170,845,250,step>1?p:0,teal);
  if(step===1){box(x+440,y+230,350,90,'#162a36f2',gold);txt('首次预报已封存',x+470,y+286,29,gold);}
  txt(step===3?'修订另存版本，首次结果仍然保留':'比较同一批时刻；缺失点不偷偷补齐',x+45,y+480,28,ink);
 }else{
  const labels=['打印与器材','原始测量','冻结模型','首次验证','复跑入口','限制说明'];labels.forEach((label,i)=>{const X=x+20+(i%3)*306,Y=y+30+Math.floor(i/3)*185;box(X,Y,275,135,'#132632',i<=Math.floor(p*6)?teal:dim);txt(String(i+1).padStart(2,'0'),X+20,Y+40,22,gold,'monospace');txt(label,X+20,Y+95,31);});
  txt(step===3?'交付文件本体；索引和自检不能代替验收':'从干净目录重建同一份工程结果',x+25,y+465,28,gold);
 }
}
window.draw=function(t){const W=1920,H=1080;ctx.clearRect(0,0,W,H);const scale=1+.012*Math.min(t,30)/30;ctx.save();ctx.translate(W/2,H/2);ctx.scale(scale,scale);ctx.drawImage(background,-W/2,-H/2,W,H);ctx.restore();
 let stage=0,local=t;for(let i=0;i<lengths.length;i++){if(local<lengths[i]||i===lengths.length-1){stage=i;break;}local-=lengths[i];}
 const progress=Math.min(1,local/Math.max(1,lengths[stage]-.8));
 const shade=ctx.createLinearGradient(0,0,W,0);shade.addColorStop(0,'#081722eb');shade.addColorStop(.4,stage?'#081722b0':'#08172260');shade.addColorStop(1,stage?'#08172298':'#08172210');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
 txt('FUTURE ENERGY / LABORATORY MISSION',90,82,22,gold,'monospace');txt(String(item.level).padStart(2,'0'),90,188,70,gold,'monospace');txt(item.title,230,183,60);
 line(90,226,1830,226,'#97b6bf55',1);
 if(stage===0){wrap(item.dialogue,95,375,610,43,ink,72);txt('先看现场，再领取你的任务',95,855,26,gold);}
 else{const step=item.steps[stage-1];txt('0'+stage+' / 本站行动',95,320,23,gold,'monospace');wrap(step.label,95,403,610,48,ink,68);wrap(step.voice,95,548,570,31,'#d5dedb',53);box(770,265,1060,655,'#091a23e8','#8ea9b655',18);scene(item.station,stage,local,progress);}
 for(let i=0;i<4;i++){box(95+i*430,978,390,3,'#7b969647',null,0);if(i<stage)box(95+i*430,978,390,3,gold,null,0);else if(i===stage)box(95+i*430,978,390*progress,3,gold,null,0);}
 txt(stage===0?'01 / 实验室任务简报':`${stage+1} / ${item.steps[stage-1].label}`,95,945,23,dim);txt('AI 实验室场景 · 操作示意 · 非学生实测 · 实际器材以原课程为准',95,1033,23,'#c8d2cc');
};
