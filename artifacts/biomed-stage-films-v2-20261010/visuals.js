/* Canvas-native exact labels and diagrams over photographic labs. No AI-generated numbers. */
const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
const C={ink:'#eaf5f7',muted:'#9db5bd',teal:'#65ddc6',blue:'#7ebfff',amber:'#efbf6b',red:'#ef928c',panel:'#0c202c'};
const clamp=x=>Math.min(1,Math.max(0,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function text(v,x,y,size=32,color=C.ink,align='left',weight=400){c.fillStyle=color;c.font=`${weight} ${size}px "PingFang SC", "Helvetica Neue", sans-serif`;c.textAlign=align;c.fillText(v,x,y)}
function box(x,y,w,h,fill=C.panel,stroke='#35505e',r=16){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke()}}
function line(x,y,a,b,color=C.teal,width=3,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x,y);c.lineTo(a,b);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([])}
function arrow(x,y,a,b,color=C.teal){line(x,y,a,b,color,4);const t=Math.atan2(b-y,a-x);line(a,b,a-17*Math.cos(t-.45),b-17*Math.sin(t-.45),color,4);line(a,b,a-17*Math.cos(t+.45),b-17*Math.sin(t+.45),color,4)}
function badge(label,x,y,color=C.teal,width=270){box(x,y,width,54,'#132f3b',color,9);text(label,x+width/2,y+37,27,color,'center',500)}
function check(x,y,color=C.teal){line(x,y,x+10,y+12,color,5);line(x+10,y+12,x+30,y-15,color,5)}
function lock(x,y,open=false){c.strokeStyle=open?C.teal:C.amber;c.lineWidth=7;c.beginPath();c.arc(x+34,y+27,26,Math.PI,open?-.7:0);c.stroke();box(x,y+27,68,55,'#183440',open?C.teal:C.amber,8);line(x+34,y+46,x+34,y+66,open?C.teal:C.amber,6)}
function molecule(cx,cy,scale,angle){
 const colors={C:'#98b3c4',N:'#6daafd',O:'#e67875',H:'#e8f1f3'};
 const points=model.atoms.map(a=>{const [x,y,z]=a.position;const X=x*Math.cos(angle)+z*Math.sin(angle),Z=-x*Math.sin(angle)+z*Math.cos(angle),Y=y*Math.cos(.3)-Z*Math.sin(.3);return {x:cx+X*scale,y:cy+Y*scale,z:Z,element:a.element}});
 const objects=[...model.bonds.map(b=>({z:(points[b.a].z+points[b.b].z)/2,type:'bond',...b})),...points.map((a,i)=>({...a,i,type:'atom'}))].sort((a,b)=>a.z-b.z);
 for(const o of objects){if(o.type==='bond'){const a=points[o.a],b=points[o.b];line(a.x,a.y,b.x,b.y,'#4f6c7b',Math.max(3,scale*.12));if(o.order>=2)line(a.x+8,a.y+5,b.x+8,b.y+5,'#6b8590',Math.max(2,scale*.055));}else{const r=scale*(o.element==='H'?.16:.29)*(1+o.z*.015);const g=c.createRadialGradient(o.x-r*.4,o.y-r*.45,r*.1,o.x,o.y,r);g.addColorStop(0,'#fff');g.addColorStop(.24,colors[o.element]);g.addColorStop(1,o.element==='O'?'#703b3c':o.element==='N'?'#254f79':'#344955');c.beginPath();c.arc(o.x,o.y,r,0,Math.PI*2);c.fillStyle=g;c.fill();}}
}
function observation(step,p,t){
 box(240,260,820,510,'#102733','#294550');
 for(let n=0;n<6;n++){line(280,330+n*70,1020,330+n*70,'#1c3845',1);line(350+n*120,290,350+n*120,740,'#1c3845',1)}
 molecule(650,492,59,t*.18);text('咖啡因 · C₈H₁₀N₄O₂',650,725,30,C.muted,'center');
 box(1120,260,560,510,'#102733');text('我的分子观察卡',1160,322,38,C.ink,'left',600);
 text('分子编号',1160,392,27,C.muted);text('PubChem CID 2519',1160,440,32);
 text('观察角度',1160,506,27,C.muted);text(step>0?'旋转后 · 侧面':'拖动模型，寻找一个角度',1160,550,30,step>0?C.teal:C.ink);
 if(step>0){text('发现：原子连接保持不变',1160,624,30);badge(step===2?'观察卡已生成':'保存这个视角',1160,666,C.teal,460)}
 if(step===2){badge('观察 → 筛选 → 检验',380,798,C.teal,1160)}
 else text('三维计算模型 · 不是显微照片',650,826,26,C.muted,'center');
}
function filter(step,p){
 const limit=step===2?400:350;
 badge(`MW ≤ ${limit} g/mol`,240,255,C.blue,410);badge('logP ≤ 3.0',690,255,C.blue,390);badge('缺失 → 暂存',1120,255,C.amber,560);
 const labels=['保留','排除','暂存'],colors=[C.teal,C.red,C.amber];
 labels.forEach((v,i)=>{box(240+i*485,354,450,394,'#102733',colors[i]);text(v,465+i*485,408,34,colors[i],'center',600)});
 const progress=step===0?ease(p*1.6):1;
 const cards=[['ESOL-0099','MW 120.2 · logP 1.76',0],['ESOL-1071','MW 376.5 · logP 2.92',step===2?0:1],['QC-MISSING','质量缺失 · 教学故障卡',2]];
 cards.forEach(([id,value,lane],i)=>{let x=740+(270+lane*485-740)*progress,y=470+(i===1&&step===2?130:0);box(x,y,390,112,'#1c3945',colors[lane],10);text(id,x+24,y+43,30,colors[lane]);text(value,x+24,y+87,25,C.ink)});
 text(step===2?'规则 A：保留 1 条   →   规则 B：保留 2 条':'运行条件后，每一条卡片都有去向',960,810,36,C.ink,'center',500);
 text('展示 2 条 ESOL 记录 + 1 条缺失故障卡；不代表整批结果',960,845,25,C.muted,'center');
}
function prediction(step,p){
 if(step===0){
  text('同一个分子的溶解度',280,310,33,C.muted);
  const ox=340,oy=726,w=700,h=330;line(ox,oy,ox+w,oy,C.muted,2);line(ox,oy,ox,oy-h,C.muted,2);
  for(let i=0;i<=5;i++){const y=oy-i*66;line(ox,y,ox+w,y,'#28424e',1);text(String(-5+i),ox-28,y+10,28,C.muted,'right')}
  const grow=ease(p*1.7);box(460,oy-3*66*grow,150,3*66*grow,C.blue,null,0);box(780,oy-1*66*grow,150,1*66*grow,C.teal,null,0);
  text('预测 −2',535,780,34,C.blue,'center');text('测量 −4',855,780,34,C.teal,'center');
  box(1150,375,480,335,'#102733');text('绝对误差',1390,445,34,C.muted,'center');text('|−2 − (−4)|',1390,525,40,C.ink,'center');text('2',1390,634,86,C.amber,'center',600);
  text('单位：log₁₀(mol/L) · 数值为教学示例',280,862,28,C.muted);
 }else{
  text('同一验证集 · 平均绝对误差 MAE',280,310,36,C.ink);text('越小越好；此处数值仅演示比较方法',280,357,28,C.muted);
  [['简单基线',1.6,C.muted],['我的方法',.9,C.teal]].forEach(([label,v,color],i)=>{text(label,280,464+i*145,35,color);box(550,420+i*145,750*v/2*ease(p*2+.2),64,color,null,8);text(v.toFixed(1),550+750*v/2+35,466+i*145,40,color)});
  if(step===2){box(280,712,1350,136,'#1d3541',C.amber);text('报告：选一个误差大的分子 → 解释失误与边界',320,767,36,C.amber);text('预测列与测量列分别保存，不把预测写成实测。',320,817,29,C.ink)}
 }
}
function systems(step,p){
 if(step===0){
  text('候选表',420,311,34,C.muted,'center');text('返回的预测表',1410,311,34,C.muted,'center');
  ['A12','A13','A14'].forEach((id,i)=>{box(280,360+i*134,320,98);text(id,440,424+i*134,40,C.ink,'center')});
  ['A13','A14','A12'].forEach((id,i)=>{box(1260,360+i*134,370,98);text(id+'  →  预测',1445,424+i*134,36,C.ink,'center')});
  const fixed=p>.35;
  [0,1,2].forEach(i=>{const j=fixed?[2,0,1][i]:i;arrow(630,407+i*134,1220,407+j*134,fixed?C.teal:C.red)});
  badge(fixed?'按 ID 关联：匹配正确':'按行号硬接：错位',660,799,fixed?C.teal:C.red,600);
 }else if(step===1){
  ['检查预算','封存规则','打开新数据'].forEach((v,i)=>{box(270+i*490,384,430,320);text(v,485+i*490,451,37,C.ink,'center',500);if(i<2)arrow(710+i*490,545,740+i*490,545);if(i===0){text('12 → 7',485,590,64,C.blue,'center');text('教学预算点',485,650,28,C.muted,'center')}else lock(451+i*490,520,i===2&&p>.55)});
  text('先封存，再揭晓；首次记录不覆盖',960,810,38,C.amber,'center');
 }else{
  ['工作台','两种预算清单','首次挑战记录'].forEach((v,i)=>{box(270+i*490,375,430,300);text('0'+(i+1),310+i*490,440,34,C.teal);text(v,485+i*490,548,37,C.ink,'center',500);check(470+i*490,620)});
  badge('原始结果 v1 保留  /  事后改进另存 v2',360,764,C.teal,1200);
 }
}
function protocol(step,p){
 const cards=[['研究对象','EGFR','P00533 / CHEMBL203','人类 · 单一蛋白'],['测量端点','先明确主要端点','记录类型、关系符与单位','核对测定条件'],['判断规则','先写排除条件','哪些记录可比？','哪些仍需核查？']];
 cards.forEach((a,i)=>{box(260+i*495,320,455,380,'#102733',i===0?C.blue:'#35505e');text(a[0],290+i*495,377,29,C.muted);text(a[1],290+i*495,456,i===0?54:35,C.ink,'left',600);text(a[2],290+i*495,539,26,C.blue);text(a[3],290+i*495,600,29,C.ink);if(step>0)check(620+i*495,650)});
 if(step>0){badge('研究协议 v1 · 已冻结',460,759,C.teal,1000);lock(380,742)}else text('把一个愿望，收敛为可检验的问题',960,799,36,C.ink,'center');
 if(step===2)text('ESOL 练习 ≠ 药物活性证据',960,850,29,C.amber,'center');
}
function dataStage(step,p){
 const rows=[['R01','来源 A · 单位已核对','保留'],['R02','与 R01 重复','合并并记录理由'],['R03','关键字段缺失','标记待核查']];
 if(step<2){
  text(step===0?'原始快照：来源与编号一起保存':'清洗账本：处理前后都能追查',280,311,36,C.ink);
  rows.forEach((r,i)=>{box(280,357+i*133,1340,112,'#102733',step===1?i===1?C.amber:i===2?C.red:C.teal:'#35505e');text(r[0],314,424+i*133,37,C.blue);text(r[1],490,424+i*133,32);if(step===1&&p>i*.13){arrow(1040,412+i*133,1110,412+i*133);text(r[2],1140,424+i*133,30,i===2?C.amber:C.teal)}});
  badge('原始数据保留 · 清洗结果另存',460,790,C.teal,1000);
 }else{
  ['训练 / 开发','结构分组冻结','保留集未开封'].forEach((v,i)=>{box(270+i*490,372,430,350);text(v,485+i*490,441,35,C.ink,'center');if(i===2)lock(451+i*490,530);else for(let j=0;j<3;j++)badge(i===0?['描述符','过滤器','相似性基线'][j]:['骨架组 A','骨架组 B','骨架组 C'][j],315+i*490,490+j*63,i===0?C.teal:C.blue,340)});
  text('交付：清洗账本 + 基线 + 固定分组',960,818,39,C.teal,'center');
 }
}
function evaluation(step,p){
 if(step===0){
  text('相同开发数据 · 相同指标',280,316,39,C.ink);
  [['基线',.76,C.muted],['树',.9,C.blue],['森林',.85,C.teal]].forEach(([label,v,color],i)=>{text(label,280,448+i*120,36,color);box(440,403+i*120,950*v*ease(p*2+.2),64,color,null,8)});
  text('示意条形图 · 数值与胜者由你的实验决定',280,842,30,C.amber);
 }else if(step===1){
  ['冻结配置','一次保留集评价','保留首次结果'].forEach((v,i)=>{box(270+i*490,360,430,360);text(v,485+i*490,430,36,C.ink,'center');if(i<2)arrow(710+i*490,570,740+i*490,570);lock(451+i*490,526,i>0&&p>.35);if(i===2&&p>.7)check(600+i*490,657)});
  text('开发阶段结束后，才打开独立保留集',960,819,38,C.amber,'center');
 }else{
  const entries=[['首次结果','保留原始评估'],['失败案例','定位错误与原因'],['未知范围','写清适用边界']];
  entries.forEach((a,i)=>{box(280,330+i*157,1330,124,'#102733',i===2?C.amber:C.teal);text(a[0],330,407+i*157,38,i===2?C.amber:C.teal);text(a[1],850,407+i*157,36)});
 }
}
function delivery(step,p){
 if(step===0){
  text('候选 A · 证据必须同行',280,315,39,C.ink);
  [['支持','可追查的计算与来源',C.teal],['反对','冲突与失败结果',C.red],['未知','仍需验证的问题',C.amber]].forEach(([title,body,color],i)=>{box(270+i*490,377,430,350,'#102733',color);text(title,485+i*490,484,48,color,'center',600);text(body,485+i*490,590,30,C.ink,'center')});
 }else{
  box(270,310,800,500,'#102733',C.teal);text('候选研究档案',315,380,43,C.ink,'left',600);
  ['数据与清洗账本','环境版本与运行入口','引用与候选理由','首次评估与未知范围'].forEach((v,i)=>{const ready=step===2||p>i*.18;text(v,340,465+i*90,33,ready?C.ink:C.muted);if(ready)check(975,455+i*90)});
  arrow(1110,550,1230,550);box(1270,370,365,330,'#173740',C.teal);text('下一位研究者',1452,455,36,C.ink,'center');text(step===2?'按步骤复核':'可复跑的交接',1452,553,33,C.teal,'center');
  if(step===2)badge('候选研究 ≠ 疗效或安全证明',320,789,C.amber,1280);
 }
}
window.draw=function(t){
 let local=t,step=0;while(step<2&&local>=lengths[step]){local-=lengths[step];step++}const p=clamp(local/lengths[step]);
 c.clearRect(0,0,1920,1080);const zoom=1.025+Math.min(t,30)*.0005;c.drawImage(background,960-960*zoom,540-540*zoom,1920*zoom,1080*zoom);c.fillStyle='rgba(4,17,26,.34)';c.fillRect(0,0,1920,1080);
 box(180,160,1560,750,'rgba(8,26,38,.96)','#3e5c69',20);
 text(`分子寻药  /  ${String(item.level).padStart(2,'0')}  ${item.title}`,195,104,39,C.ink,'left',500);
 text('教学演示 · 操作与数据示意',1720,103,27,'#fff','right');
 text(item.steps[step].label,240,226,41,C.ink,'left',600);text(`0${step+1} / 03`,1680,224,28,C.teal,'right');line(240,243,1680,243,'#34505e',1);
 c.save();c.globalAlpha=ease(local/.35);c.translate(0,(1-ease(local/.35))*14);[observation,filter,prediction,systems,protocol,dataStage,evaluation,delivery][item.level-1](step,p,t);c.restore();
 item.steps.forEach((s,i)=>{const x=205+i*510,color=i===step?C.teal:'#a0b9c1';line(x,954,x+450,954,'#334e5c',5);if(i<=step)line(x,954,x+450*(i<step?1:p),954,C.teal,5);/* Reserve lower band for native captions and player controls. */});
};
