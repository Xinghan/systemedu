// SystemEdu 参数化夹爪起点，单位 mm；尚未实物打样。
// 全部自制结构 FDM 打印。保留原配摇臂，按实测尺寸修改安装孔。
$fn=64; finger=55; gap=55; bore=3.3;
// 可选：base / moving-finger / servo-cheek / anvil / contact-pad / fit-coupon / angle-bracket
part="moving-finger";
module profile(points,holes,t){difference(){linear_extrude(t)polygon(points);for(h=holes)translate([h[0],h[1],-1])cylinder(h=t+2,r=h[2]);}}
if(part=="base") profile([[-55,0],[55,0],[55,105],[-55,105]],[[-43,10,1.7],[43,10,1.7],[-43,95,1.7],[43,95,1.7],[-15,20,1.7],[15,20,1.7]],5); // qty 1
if(part=="moving-finger") profile([[-8,-9],[8,-9],[8,finger-12],[6,finger+5],[-6,finger+5],[-8,finger-12]],[[0,0,bore/2],[0,9,1.2],[0,18,1.2],[0,finger-5,1.7]],5); // qty 1
if(part=="servo-cheek") profile([[-22,0],[22,0],[16,gap+28],[-16,gap+28]],[[-13,7,1.7],[13,7,1.7],[-10,gap+8,1.2],[10,gap+8,1.2]],5); // qty 2
if(part=="anvil") profile([[-18,0],[18,0],[18,48],[-18,48]],[[-12,8,1.7],[12,8,1.7],[-12,40,1.7],[12,40,1.7]],6); // qty 1
if(part=="contact-pad") profile([[-10,0],[10,0],[10,16],[-10,16]],[[0,8,1.7]],3); // qty 1
if(part=="fit-coupon") profile([[-22,0],[22,0],[22,20],[-22,20]],[[-13,10,(bore-.1)/2],[0,10,bore/2],[13,10,(bore+.1)/2]],4); // qty 1
if(part=="angle-bracket") profile([[0,0],[24,0],[24,5],[5,5],[5,24],[0,24]],[],18); // qty 4
// finger、gap、bore 直接驱动相关零件。修改后 F6 渲染并重新导出 STL。
// 直角座需增加穿过两侧面的安装孔；坐标按本人底座/支架匹配。参见制作指南。
