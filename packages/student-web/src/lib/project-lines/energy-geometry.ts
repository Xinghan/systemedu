import type { EnergyConfig } from './energy-model'

// 模数 1、压力角 20°的渐开线采样。齿根以径向段连接；不是生产级滚刀刀具仿真。
export function gearOutline(teeth: number): [number, number][] {
  const pitch = teeth / 2, base = pitch * Math.cos(Math.PI / 9), root = pitch - 1.25, tip = pitch + 1
  const inv = (r: number) => { const a = Math.acos(Math.min(1, base / r)); return Math.tan(a) - a }
  const half = Math.PI / (2 * teeth) - .025 / pitch, points: [number, number][] = []
  const polar = (r: number, a: number) => points.push([r * Math.cos(a), r * Math.sin(a)])
  for (let i = 0; i < teeth; i++) {
    const center = i * Math.PI * 2 / teeth, start = Math.max(root, base), h = half + inv(pitch) - inv(start)
    polar(root, center - Math.PI / teeth); polar(root, center - h)
    for (let j = 0; j <= 7; j++) { const r = start + (tip - start) * j / 7; polar(r, center - half - inv(pitch) + inv(r)) }
    for (let j = 7; j >= 0; j--) { const r = start + (tip - start) * j / 7; polar(r, center + half + inv(pitch) - inv(r)) }
    polar(root, center + h)
  }
  return points
}
export const energyDimensions = (c: EnergyConfig) => ({ center: (c.teeth + 18) / 2 + c.meshGap, width: 1.5 * c.teeth + 46 + 2 * c.meshGap, depth: c.teeth + 22, bore: 3 + c.clearance })
export function generatorCAD(c: EnergyConfig): string {
  return `// SystemEdu 打印传动试制源 / 单位 mm / 未经实物试配
// 改齿数、孔径补偿、中心距补偿后，重新渲染再导出 STL。先打印 coupon。
part="coupon"; // coupon, big, pinion, motor_pinion, base, spacer, crank, knob, motor_shelf, guard, crank_collar
teeth=${c.teeth}; clearance=${c.clearance}; mesh_gap=${c.meshGap};
motor_bore=2.0; // 必须测量实购电机轴；用试配片修改，不能锤击压入
motor_lift=0; // 电机独立打印垫片高度，以实际轴肩高度对齐第二级齿轮
spacer_height=26.5; // 中间轴 26.5；输入轴 32.5；护罩柱 43 mm
$fn=64;
center=(teeth+18)/2+mesh_gap; x0=teeth/2+10; yy=(teeth+22)/2;
ww=1.5*teeth+46+2*mesh_gap; dd=teeth+22;
function inv(r,b)=let(a=acos(min(1,b/r))) tan(a)-a*PI/180;
function polar(r,a)=[r*cos(a),r*sin(a)];
function flank(n,r)=90/n-0.025/(n/2)*180/PI+(inv(n/2,n/2*cos(20))-inv(r,n/2*cos(20)))*180/PI;
function outline(n)=let(root=n/2-1.25,tip=n/2+1,start=max(root,n/2*cos(20))) [for(i=[0:n-1]) each concat([polar(root,i*360/n-180/n),polar(root,i*360/n-flank(n,start))],[for(j=[0:7]) let(r=start+(tip-start)*j/7) polar(r,i*360/n-flank(n,r))],[for(j=[7:-1:0]) let(r=start+(tip-start)*j/7) polar(r,i*360/n+flank(n,r))],[polar(root,i*360/n+flank(n,start))])];
module gear(n,bore,bolts=true){difference(){linear_extrude(6) polygon(outline(n));translate([0,0,-1]) cylinder(h=8,d=bore);if(bolts)for(a=[0:120:240])translate([5*cos(a),5*sin(a),-1])cylinder(h=8,d=2.3);}}
module plate(w,d,h=3){cube([w,d,h]);}
if(part=="big") gear(teeth,3+clearance);
if(part=="pinion") gear(18,3+clearance);
if(part=="motor_pinion") gear(18,motor_bore,false);
if(part=="coupon") difference(){plate(70,18);for(i=[0:4])translate([8+i*13,9,-1]) cylinder(h=5,d=3+i*.2);}
if(part=="base")difference(){plate(ww,dd);for(x=[x0,x0+center])translate([x,yy,-1])cylinder(h=5,d=3.4);for(x=[x0+2*center-12,x0+2*center+12])for(y=[yy-16,yy+16])translate([x,y,-1])cylinder(h=5,d=3.4);for(x=[6,ww-6])for(y=[6,dd-6])translate([x,y,-1])cylinder(h=5,d=3.4);}
if(part=="spacer")difference(){cylinder(h=spacer_height,d=10);translate([0,0,-1])cylinder(h=spacer_height+2,d=3.4);}
if(part=="crank_collar")difference(){cylinder(h=8,d=14);translate([0,0,-1])cylinder(h=10,d=3.4);for(a=[0:120:240])translate([5*cos(a),5*sin(a),-1])cylinder(h=10,d=2.3);}
if(part=="crank")difference(){hull(){cylinder(h=4,d=15);translate([22,0,0])cylinder(h=4,d=12);}for(a=[0:120:240])translate([5*cos(a),5*sin(a),-1])cylinder(h=6,d=2.3);translate([0,0,-1])cylinder(h=6,d=3.4);translate([22,0,-1])cylinder(h=6,d=3.4);}
if(part=="knob")difference(){cylinder(h=14,d=12);translate([0,0,-1])cylinder(h=16,d=3.4);}
// 电机不依赖特定金属夹具：在平托架上用两条扎带固定。垫片和轴孔由实测调整。
if(part=="motor_shelf")difference(){plate(30,38,3+motor_lift);for(x=[3,27])for(y=[3,35])translate([x,y,-1])cylinder(h=6+motor_lift,d=3.4);for(x=[4,24])translate([x,8,-1])cube([2,22,6+motor_lift]);}
// 护罩平放打印，4 个打印支柱承托；尺寸必须结合摇柄高度试配。
if(part=="guard")difference(){plate(ww,dd,2);for(x=[6,ww-6])for(y=[6,dd-6])translate([x,y,-1])cylinder(h=4,d=3.4);translate([x0,yy,-1])cylinder(h=4,d=17);}
`
}
