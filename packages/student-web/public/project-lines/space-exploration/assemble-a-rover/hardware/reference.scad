// SystemEdu 桌面探测车 2.0，单位 mm；未做实机制造验证。
// part: deck / strap / bumper / coupon。先打印 coupon 试配。
part="deck";
width=100; length=150; thickness=3; hole=3.4;
$fn=48;
module deck(){difference(){translate([-width/2,-length/2,0])cube([width,length,thickness]);for(x=[-width/2+12,width/2-12])for(y=[-55,-35,0,35,55])translate([x,y,-1])cylinder(h=thickness+2,d=hole);for(x=[-width/2+8,width/2-8])for(y=[-43,-25])translate([x-2,y-5,-1])cube([4,10,thickness+2]);for(x=[-20,20])translate([x-2,10,-1])cube([4,28,thickness+2]);}}
module strap(){difference(){cube([32,12,3]);for(x=[4,28])translate([x,6,-1])cylinder(h=5,d=hole);}}
module bumper(){union(){cube([width-16,12,3]);translate([0,9,0])cube([width-16,3,16]);}}
module coupon(){difference(){cube([60,16,3]);for(i=[0:4])translate([8+i*11,8,-1])cylinder(h=5,d=3+i*0.2);}}
if(part=="deck")deck();else if(part=="strap")strap();else if(part=="bumper")bumper();else coupon();
