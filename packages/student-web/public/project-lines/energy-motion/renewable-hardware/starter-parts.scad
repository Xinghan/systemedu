// SystemEdu wind-solar starter, mm. Unprinted design; measure your purchased parts first.
// This source matches flat STL templates; complete mounts/guard mesh are a learner CAD task.
$fn=96; bore=2.2; radius=55; pitch=25;
part="fit-coupon";
module flat(w,h,t,holes){ difference(){translate([-w/2,-h/2,0])cube([w,h,t]); for(p=holes) translate([p[0],p[1],-1])cylinder(h=t+2,r=p[2]);}}
module disk(r,t,holes){difference(){cylinder(h=t,r=r);for(p=holes)translate([p[0],p[1],-1])cylinder(h=t+2,r=p[2]);}}
if(part=="base")flat(130,90,4,[[-40,0,1.7],[40,0,1.7],[0,0,1.7],[-50,-30,1.7],[50,-30,1.7]]);
if(part=="solar-tray")flat(51,51,3,[[-21,-21,1.7],[21,-21,1.7],[-21,21,1.7],[21,21,1.7],[0,0,1.7]]);
if(part=="fit-coupon")flat(42,18,4,[[-12,0,(bore-.1)/2],[0,0,bore/2],[12,0,(bore+.1)/2]]);
if(part=="rotor-hub")disk(16,5,concat([[0,0,bore/2]],[for(i=[0:2])[10*cos(i*120),10*sin(i*120),1.7]]));
if(part=="guard-ring")disk(radius+10,5,[[0,0,radius+5]]);
if(part=="rotor-blade")difference(){linear_extrude(2.4)polygon([[0,-6],[radius-12,-10],[radius-10,4],[6,7],[0,6]]);translate([5,0,-1])cylinder(h=5,r=1.7);}
if(part=="upright")difference(){linear_extrude(5)polygon([[-28,0],[28,0],[18,65],[-18,65]]);for(p=[[-18,8],[18,8],[0,52]])translate([p[0],p[1],-1])cylinder(h=7,r=1.7);}
// Custom pitch wedge: print a pair for each blade, add fastening holes after measuring root.
if(part=="pitch-wedge")rotate([90,0,0])linear_extrude(12)polygon([[0,0],[12,0],[12,12*tan(pitch)]]);
