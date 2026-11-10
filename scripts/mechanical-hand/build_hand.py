"""Original articulated teaching hand. Blender 4.5: -b --python build_hand.py -- --render."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
rig=json.loads((ROOT/'packages/student-web/src/components/learning/mechanical-hand/rig.json').read_text())
p=argparse.ArgumentParser();p.add_argument('--render',action='store_true');p.add_argument('--output',default=str(ROOT/'packages/student-web/public/mechanical-hand'))
args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.frame_start=0;scene.frame_end=96;scene.render.fps=24
scene.world.color=(.68,.72,.72)

def mat(name,color,metal=0,rough=.45):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 return m
ivory=mat('Pearl polymer shell',(.79,.81,.79),.22,.32);carbon=mat('Graphite chassis',(.045,.06,.065),.35,.4)
metal=mat('Machined titanium',(.40,.46,.48),.8,.26);brass=mat('Satin bearing alloy',(.31,.38,.40),.8,.29)
rubber=mat('Elastomer pads',(.045,.067,.071),.02,.8);orange=mat('Tendon orange',(.8,.25,.065),.1,.4)
teal=mat('Actuator teal',(.07,.23,.24),.4,.34);black=mat('Fastener sockets',(.015,.025,.025),.1,.7)

def group(name,parent=None,**extras):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
 if parent:o.parent=parent
 for k,v in extras.items():o[k]=v
 return o
def finish(o,name,material,parent=None,bevel=0,**extras):
 o.name=name;o.data.materials.append(material)
 if parent:o.parent=parent
 if bevel:
  mod=o.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for k,v in extras.items():o[k]=v
 return o
def box(name,loc,dims,m,parent=None,bevel=.06,**extras):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dims
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,m,parent,bevel,**extras)
def cyl(name,loc,radius,depth,m,parent=None,rot=(0,0,0),n=32,**extras):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=radius,depth=depth,location=loc,rotation=rot)
 o=finish(bpy.context.object,name,m,parent,0,**extras)
 for poly in o.data.polygons:poly.use_smooth=len(poly.vertices)==4
 return o
def rod(name,a,b,r,m,parent):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,m,parent,n=12)
 o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def bolt(loc,parent,r=.13):
 cyl('Hex bolt',loc,r,.11,metal,parent,rot=(math.pi/2,0,0),n=6)
 cyl('Hex socket',(loc[0],loc[1]-.06,loc[2]),r*.45,.012,black,parent,rot=(math.pi/2,0,0),n=6)
def torus(name,loc,r,minor,m,parent,rot=(0,math.pi/2,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=minor,major_segments=32,minor_segments=8,location=loc,rotation=rot)
 return finish(bpy.context.object,name,m,parent)
def native(v):return (v[0],-v[2],v[1])

def shaped_mesh(name,vertices,faces,m,parent):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);finish(o,name,m,parent)
 for face in data.polygons:face.use_smooth=True
 return o

def loft(name,sections,m,parent,power=2.8):
 """Rounded, tapered cross-sections: z, half-width, depth center, half-depth."""
 n=48;verts=[]
 for z,w,y,d in sections:
  for i in range(n):
   a=i*math.tau/n;c=math.cos(a);s=math.sin(a)
   verts.append((w*math.copysign(abs(c)**(2/power),c),y+d*math.copysign(abs(s)**(2/power),s),z))
 faces=[]
 for row in range(len(sections)-1):
  for i in range(n):a=row*n+i;b=row*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 faces.extend([tuple(reversed(range(n))),tuple(range((len(sections)-1)*n,len(sections)*n))])
 return shaped_mesh(name,verts,faces,m,parent)

def smooth_outline(points):
 result=[];count=len(points)
 for i in range(count):
  p0,p1,p2,p3=[Vector(points[j%count]) for j in [i-1,i,i+1,i+2]]
  for j in range(5):
   t=j/5;v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);result.append(tuple(v))
 return result

def sculpted_panel(name,outline,surface,m,parent,thickness=.13,bulge=0):
 """An organic closed panel sampled on a curved surface, with an actual rim thickness."""
 outline=smooth_outline(outline);n=len(outline)
 cx=sum(p[0] for p in outline)/n;cz=sum(p[1] for p in outline)/n
 rings=[.12,.3,.5,.7,.85,.95,1.0]
 vertices=[(cx,surface(cx,cz)-bulge,cz)]
 for r in rings:
  for x,z in outline:
   xx=cx+(x-cx)*r;zz=cz+(z-cz)*r;vertices.append((xx,surface(xx,zz)-bulge*(1-r*r),zz))
 front=len(vertices);vertices.extend([(x,y+thickness,z) for x,y,z in vertices.copy()])
 faces=[]
 for i in range(n):faces.append((0,1+i,1+(i+1)%n))
 for j in range(len(rings)-1):
  for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 faces.extend([tuple(front+i for i in reversed(face)) for face in faces.copy()])
 start=1+(len(rings)-1)*n
 for i in range(n):a=start+i;b=start+(i+1)%n;faces.append((a,a+front,b+front,b))
 return shaped_mesh(name,vertices,faces,m,parent)

def palm_surface(x,z):
 thenar=math.exp(-((x+2.7)/1.5)**2-((z-8.3)/2.2)**2)
 ulnar=math.exp(-((x-2.5)/1.2)**2-((z-8.7)/2.5)**2)
 return -.6-.82*thenar-.5*ulnar-.15*((z-9.4)/4.5)**2

def surface_line(name,points,surface,m,parent,radius=.025):
 for (x1,z1),(x2,z2) in zip(points,points[1:]):rod(name,(x1,surface(x1,z1)-.02,z1),(x2,surface(x2,z2)-.02,z2),radius,m,parent)

hand=group('MechanicalHand',asset_id='tendon-hand-v1',appearance_revision=2)
cuff=group('Wrist',hand,part='wrist')
cyl('Wrist flange',(0,0,1.02),1.9,.42,metal,cuff,n=64)
cyl('Wrist coupler',(0,0,2.0),1.5,1.5,carbon,cuff,n=64)
fairing=group('WristShell',cuff,shell=True)
loft('Tapered wrist fairing',[(1.15,1.9,0,1.3),(1.35,2.12,0,1.5),(2.3,2.5,0,1.6),(3.8,3.0,0,1.65),(4.8,2.95,0,1.6),(5.35,2.4,0,1.35),(5.8,1.85,0,1.0)],ivory,fairing,power=2.5)
loft('Wrist gasket',[(1.13,1.9,0,1.31),(1.25,2.04,0,1.44),(1.31,2.08,0,1.47)],carbon,cuff,power=2.5)
for x in [-1.2,1.2]:
 rod('Wrist load strut',(x*.7,.25,2.1),(x,.2,6.5),.18,metal,hand)
 bolt((x,-1.57,2.1),fairing,.09)
for x in [-.7,0,.7]:box('Wrist ventilation slot',(x,-1.655,3.15),(.16,.035,.7),carbon,fairing,.06)
palm=group('Palm',hand,part='palm')
outline=[(-1.7,5.1),(-2.4,6.15),(-3.5,7.1),(-4.22,8.05),(-4.3,8.85),(-3.7,10.1),(-3.85,11.5),(-3.6,12.55),(-3.1,13.1),(-2.2,13.12),(-1.35,13.5),(-.4,13.5),(.6,13.17),(1.7,13.14),(2.6,12.65),(3.43,12.55),(3.74,11.75),(3.48,9.6),(3.05,7.6),(2.4,6.05),(1.65,5.1)]
rim=smooth_outline(outline)
for i,((x,z),(xx,zz)) in enumerate(zip(rim,rim[1:]+rim[:1])):
 rod('Palm perimeter chassis',(x,.15,z),(xx,.15,zz),.16,carbon,palm)
for f in rig['fingers'][1:]:
 x,_,z=native(f['base']);start=(x*.48,.35,6.2);end=(x,.25,z-.35)
 rod('Metacarpal spar',start,end,.25,metal,palm)
 for side in [-1,1]:rod('Metacarpal web',(start[0]+side*.25,.35,6.3),(x+side*.3,.25,z-.45),.07,carbon,palm)
 cyl('Knuckle saddle',(x,0,z-.15),.53,f['radius']*2+.18,carbon,palm,rot=(0,math.pi/2,0))
for z,w in [(6.45,2.5),(10.8,6.6)]:box('Internal cross brace',(0,.45,z),(w,.35,.28),carbon,palm,.1)
cyl('Thumb opposition saddle',(-3.95,-.15,8.65),.8,.75,carbon,palm,rot=(math.pi/2,0,0))
cyl('Thumb opposition bearing',(-3.95,-.56,8.65),.59,.13,metal,palm,rot=(math.pi/2,0,0))
shell=group('PalmShell',palm,shell=True)
sculpted_panel('Sculpted palm shell',outline,palm_surface,ivory,shell,thickness=.17)
sculpted_panel('Sculpted dorsal shell',outline,lambda x,z:.62+.28*math.exp(-(x/3.5)**2-((z-9.5)/3.6)**2),ivory,shell,thickness=.14)
# Edge band joins the two sculpted skins without a box-shaped palm core.
sideverts=[]
for x,z in rim:sideverts.extend([(x,palm_surface(x,z),z),(x,.71,z)])
sidefaces=[(2*i,2*((i+1)%len(rim)),2*((i+1)%len(rim))+1,2*i+1) for i in range(len(rim))]
shaped_mesh('Palm edge band',sideverts,sidefaces,carbon,shell)
pads=[('Thenar pad',[(-2.6,6.9),(-3.65,7.8),(-3.72,9.0),(-2.75,10.5),(-1.6,10.25),(-1.35,9.15),(-1.75,7.65)]),('Hypothenar pad',[(1.55,6.8),(2.45,7.15),(3.12,8.65),(3.15,10.65),(2.55,11.55),(1.7,11.05),(1.1,9.35)]),('Distal palm pad',[(-2.9,11.3),(-2.65,12.5),(-1.2,12.78),(.35,12.55),(1.6,12.45),(2.4,12.0),(1.8,11.6),(.2,11.8),(-1.2,11.5)])]
for name,shape in pads:sculpted_panel(name,shape,lambda x,z:palm_surface(x,z)-.12,rubber,shell,thickness=.10,bulge=.1)
for x,z in [(-2.65,11.0),(2.95,11.85),(-1.3,5.7),(1.3,5.7)]:bolt((x,palm_surface(x,z)-.07,z),shell,.095)
surface_line('Palm central seam',[(-.5,6.0),(-.45,7.5),(-.1,8.9),(.5,9.85),(.8,10.6)],palm_surface,carbon,shell,.018)

animated_routes=[]
for f in rig['fingers']:
 fid=f['id'];root=group('Finger_'+fid,hand,finger=fid,part=fid)
 root.location=native(f['base']);root.rotation_euler[1]=-math.radians(f['spread'])
 width=f['radius']*2.05
 parent=root;previous=0
 for i,length in enumerate(f['lengths']):
  joint=group(f'Joint_{fid}_{i}',parent,joint_index=i,finger=fid);joint.location=(0,0,previous)
  cyl('Hinge axle',(0,0,0),.32,width+.23,metal,joint,rot=(0,math.pi/2,0))
  for sign in [-1,1]:
   cyl('Bearing outer',(sign*(width/2+.08),0,0),.42,.13,brass,joint,rot=(0,math.pi/2,0))
   cyl('Axle socket',(sign*(width/2+.16),0,0),.15,.035,black,joint,rot=(0,math.pi/2,0),n=6)
  torus('Tendon pulley',(0,0,0),f['arms_mm'][i]/10,.075,orange,joint)
  # Rigid link spine; shell can be removed independently for inspection.
  box('Phalanx spine',(0,.12,length/2),(width*.52,.57,length-.35),carbon,joint,.12)
  for sign in [-1,1]:box('Link rail',(sign*width*.34,.03,length/2),(.15,.55,length-.5),metal,joint,.055)
  cover=group(f'Shell_{fid}_{i}',joint,shell=True)
  loft('Tapered phalanx housing',[(.23,width*.34,.08,.34),(.4,width*.5,.08,.47),(length*.5,width*.47,.1,.47),(length-.38,width*.4,.1,.4),(length-.17,width*.23,.1,.27)],ivory,cover,power=2.6)
  loft('Contoured finger contact pad',[(.38,width*.25,-.48,.08),(.55,width*.43,-.49,.15),(length*.52,width*.42,-.5,.15),(length-.38,width*.31,-.48,.12),(length-.22,width*.12,-.45,.06)],rubber,cover,power=2.5)
  for zz in [length*.4,length*.53,length*.66]:box('Pad microgroove',(0,-.653,zz),(width*.55,.015,.025),carbon,cover,.008)
  for sign in [-1,1]:bolt((sign*width*.31,-.28,length*.6),joint,.09)
  for suffix,zz in [('in',.18),('out',length-.18)]:
   guide=group(f'Guide_{fid}_{i}_{suffix}',joint);guide.location=(0,-.72,zz)
   torus('Cable guide eye',(0,-.72,zz),.095,.035,brass,joint,rot=(0,0,0))
  tip=group(f'End_{fid}_{i}',joint);tip.location=(0,0,length)
  for frame,amount in [(0,0),(24,.2),(72,1),(96,0)]:
   joint.rotation_euler[0]=math.radians(f['limits'][i])*amount;joint.keyframe_insert(data_path='rotation_euler',frame=frame)
  parent=joint;previous=length
 # Drives below palm, one per finger.
 d=native(f['drum']);drive=group('Drive_'+fid,hand,part='drive',finger=fid)
 drive.location=d
 box('Servo housing',(0,.2,-.8),(1.28,1.5,1.7),teal,drive,.16)
 box('Servo back',(0,.95,-.8),(1.1,.15,1.3),carbon,drive)
 drum=group('Drum_'+fid,drive)
 for y in [-.46,-.75]:cyl('Drum flange',(0,y,0),.91,.1,brass,drum,rot=(math.pi/2,0,0))
 cyl('Drum core',(0,-.6,0),.8,.22,carbon,drum,rot=(math.pi/2,0,0))
 torus('Drum cable winding',(0,-.6,0),.81,.045,orange,drum,rot=(math.pi/2,0,0))
 box('Drum index',(0,-.82,.51),(.07,.05,.4),ivory,drum,.01)
 for frame,amount in [(0,0),(24,.2),(72,1),(96,0)]:
  drum.rotation_euler[1]=sum(a*r for a,r in zip(f['limits'],f['arms_mm']))*math.pi/180/rig['drum_radius_mm']*amount
  drum.keyframe_insert(data_path='rotation_euler',frame=frame)
 for x in [-.46,.46]:bolt((x,-.6,-1.25),drive,.085)
 # Guide-driven route, baked below for the source animation; browser updates its own tubes.
 route=group('SourceTendon_'+fid,hand,source_tendon=True)
 route_refs=[Vector((d[0],d[1]-.6,d[2]+.8)),Vector((d[0],-.1,7)),Vector((f['base'][0],-.1,f['base'][1]-.8))]
 scene.frame_set(0);bpy.context.view_layer.update()
 for i in range(len(f['lengths'])):
  for suffix in ['in','out']:route_refs.append(bpy.data.objects[f'Guide_{fid}_{i}_{suffix}'])
 for a,b in zip(route_refs,route_refs[1:]):
  cable=cyl('Source tendon',(0,0,0),.035,1,orange,route,n=10)
  for label,ref in [('start',a),('end',b)]:
   if isinstance(ref,bpy.types.Object):cable['route_'+label+'_guide']=ref.name
   else:cable['route_'+label+'_point']=[ref.x,ref.z,-ref.y]
  animated_routes.append((cable,a,b))

def linearize_actions():
 for o in bpy.data.objects:
  if o.animation_data and o.animation_data.action:
   for fc in o.animation_data.action.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'

# Bake against the same interpolation that will be exported, not Blender's default Bezier.
linearize_actions()
# Bake route segments so the downloadable Blender animation also keeps its tendons attached.
for frame in range(97):
 scene.frame_set(frame);bpy.context.view_layer.update()
 for cable,a,b in animated_routes:
  aa=a.matrix_world.translation if isinstance(a,bpy.types.Object) else a
  bb=b.matrix_world.translation if isinstance(b,bpy.types.Object) else b
  delta=bb-aa;cable.location=(aa+bb)/2;cable.rotation_euler=delta.to_track_quat('Z','Y').to_euler();cable.scale=(1,1,delta.length)
  for attribute in ['location','rotation_euler','scale']:cable.keyframe_insert(data_path=attribute,frame=frame)

# Preserve an editable animation and open rest pose; browser directly controls named pivots.
linearize_actions()
scene.frame_set(0)
scene['model_units']='one model unit represents 10 mm; educational dimensions'
scene['limits']='Prescribed joint coupling; no force, friction or compliance solver.'
bpy.ops.object.light_add(type='AREA',location=(-12,-18,30));bpy.context.object.data.energy=2100;bpy.context.object.data.size=16
bpy.ops.object.light_add(type='AREA',location=(15,6,24));bpy.context.object.data.energy=1500;bpy.context.object.data.size=12
bpy.ops.object.camera_add(location=(19,-37,24));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,11.3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=29;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.filepath=str(out/'poster.png')
scene.view_settings.view_transform='AgX';bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'mechanical-hand.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(out/'mechanical-hand.glb'),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='SCENE',export_anim_scene_split_object=False,export_force_sampling=True,export_cameras=False,export_lights=False)
if args.render:bpy.ops.render.render(write_still=True)
meta={'asset_id':'tendon-hand-v1','appearance_revision':2,'blender_version':bpy.app.version_string,'provenance':'Original sculpted procedural Blender mesh; no third-party geometry','source_script':'scripts/mechanical-hand/build_hand.py','rig':'packages/student-web/src/components/learning/mechanical-hand/rig.json','joints':15,'flexion_joints':14,'drives':5,'model_unit_mm':10,'source_animation_seconds':4,'runtime':'Browser evaluates joint poses and tendon paths; source closing clip is editable reference motion.','limitations':'Illustrative kinematic hand, not validated prosthesis, adaptive force equilibrium or grip-force simulation.','references':['https://www.eng.yale.edu/grablab/openhand/','https://www.eng.yale.edu/grablab/openhand/model_t.html','https://www.shadowrobot.com/wp-content/uploads/2024/06/20240610-UPDATED-shadow_dexterous_hand_e_technical_specification.pdf','https://openbionics.com/en/prosthetic-hands-that-move/']}
for name in ['mechanical-hand.glb','mechanical-hand.blend','poster.png']:
 if (out/name).exists():
  data=(out/name).read_bytes();meta[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(out/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('HAND_ASSET_COMPLETE')
