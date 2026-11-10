"""Original articulated teaching hand. Blender 4.5: -b --python build_hand.py -- --render."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
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
ivory=mat('Ceramic polymer',(.78,.79,.73),.15,.38);carbon=mat('Graphite chassis',(.07,.095,.10),.3,.46)
metal=mat('Machined titanium',(.38,.46,.46),.78,.27);brass=mat('Brass bearings',(.67,.40,.15),.75,.3)
rubber=mat('Elastomer pads',(.09,.14,.14),.02,.9);orange=mat('Tendon orange',(.9,.22,.045),.1,.4)
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

hand=group('MechanicalHand',asset_id='tendon-hand-v1')
cuff=group('Wrist',hand,part='wrist')
cyl('Wrist flange',(0,0,1.05),2.3,.45,metal,cuff,n=64)
cyl('Wrist coupler',(0,0,2.0),1.85,1.6,carbon,cuff,n=64)
for z in [1.3,2.7]:torus('Wrist ring',(0,0,z),1.85,.1,brass,cuff,rot=(0,0,0))
box('Lower palm frame',(0,0,4.5),(6.9,1.85,3.8),carbon,hand,.3,part='palm')
for x in [-2.6,2.6]:rod('Wrist strut',(x*.6,0,2.5),(x,0,6),.22,metal,hand)
palm=group('Palm',hand,part='palm')
box('Palm backplate',(0,.8,9.55),(8.05,.65,7.65),carbon,palm,.6)
for x in [-3.6,3.6]:box('Palm side rail',(x,0,9.3),(.42,1.95,7.3),metal,palm,.15)
for z in [6.2,8.3,10.4,12.5]:box('Palm transverse rib',(0,.2,z),(7.45,.45,.28),metal,palm)
shell=group('PalmShell',palm,shell=True)
box('Palm cover',(0,-1.08,9.5),(7.2,.34,6.2),ivory,shell,.5)
box('Palm contact cushion',(0,-1.31,9.8),(4.8,.18,3.65),rubber,shell,.32)
for x in [-2.95,2.95]:
 for z in [6.9,12.1]:bolt((x,-1.32,z),shell)
for x in [-2,-1,0,1,2]:box('Palm cushion groove',(x,-1.415,9.8),(.035,.025,2.7),carbon,shell,.01)

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
  box('Finger dorsal cover',(0,.43,length/2),(width,.36,length-.63),ivory,cover,.19)
  box('Finger pad',(0,-.51,length/2),(width*.91,.31,length-.7),rubber,cover,.18)
  for zz in [length*.37,length*.5,length*.63]:box('Pad groove',(0,-.675,zz),(width*.75,.025,.045),carbon,cover,.012)
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
 # Static route for editable source; browser replaces this with pose-dependent tubes.
 route=group('SourceTendon_'+fid,hand,source_tendon=True)
 route_refs=[Vector((d[0],d[1]-.6,d[2]+.8)),Vector((d[0],-.8,7)),Vector((f['base'][0],-.85,f['base'][1]-.8))]
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
meta={'asset_id':'tendon-hand-v1','blender_version':bpy.app.version_string,'provenance':'Original procedural Blender mesh; no third-party geometry','source_script':'scripts/mechanical-hand/build_hand.py','rig':'packages/student-web/src/components/learning/mechanical-hand/rig.json','joints':15,'flexion_joints':14,'drives':5,'model_unit_mm':10,'source_animation_seconds':4,'runtime':'Browser evaluates joint poses and tendon paths; source closing clip is editable reference motion.','limitations':'Illustrative kinematic hand, not validated prosthesis, adaptive force equilibrium or grip-force simulation.','references':['https://www.eng.yale.edu/grablab/openhand/','https://www.eng.yale.edu/grablab/openhand/model_t.html']}
for name in ['mechanical-hand.glb','mechanical-hand.blend','poster.png']:
 if (out/name).exists():
  data=(out/name).read_bytes();meta[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(out/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('HAND_ASSET_COMPLETE')
