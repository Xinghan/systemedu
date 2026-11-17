"""Original educational model. Run: blender -b --python build_scene.py -- --output DIR.
Geometry and keyframes are authored here; no downloaded mesh or mission telemetry.
Blender axes: Z up. glTF exporter converts to Y up for Three.js.
"""
import argparse, json, math, random, sys, hashlib
from pathlib import Path
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(__file__).resolve().parents[2] / 'packages/student-web/public/mars-landing'))
parser.add_argument('--render', action='store_true')
opts = parser.parse_args(args)
OUT = Path(opts.output); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene; scene.render.fps = 24; scene.frame_start = 0; scene.frame_end = 1008
scene.world.color = (.65, .62, .55)
random.seed(42)


def material(name, color, metallic=0, roughness=.55):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic; bsdf.inputs['Roughness'].default_value = roughness
    return m

white=material('Ceramic ivory',(.8,.79,.7),.18,.38)
gold=material('Thermal blanket',(.62,.38,.12),.72,.38)
steel=material('Titanium',(.31,.36,.38),.75,.32)
dark=material('Carbon and wheel tread',(.065,.078,.08),.35,.5)
black=material('Camera glass',(.015,.038,.05),.4,.16)
red=material('Parachute rust orange',(.75,.19,.075),0,.75)
cloth=material('Parachute warm white',(.88,.84,.72),0,.84)
shieldmat=material('Ablative tiles',(.22,.14,.09),.05,.9)
soil=material('Mars ochre regolith',(.48,.28,.17),0,1)
rockmat=material('Basalt',(.26,.20,.16),0,.98)
cord=material('Suspension cord',(.75,.72,.59),.1,.65)
flame=material('Illustrative exhaust',(.98,.46,.09),0,.4)
bsdf=flame.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Emission Color'].default_value=(1,.35,.03,1);bsdf.inputs['Emission Strength'].default_value=.7


def group(name, part=None, parent=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    if parent:o.parent=parent
    if part:o['part']=part
    return o


def finish(o,name,mat,parent=None,bevel=0):
    o.name=name
    if mat:o.data.materials.append(mat)
    if parent:o.parent=parent
    if bevel:
        mod=o.modifiers.new('Small manufactured edge','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def cube(name,loc,scale,mat,parent=None,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)


def cylinder(name,loc,radius,depth,mat,parent=None,rotation=(0,0,0),vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rotation)
    return finish(bpy.context.object,name,mat,parent)


def rod(name,a,b,radius,mat,parent=None):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,radius,(b-a).length,mat,parent,vertices=10)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o


def mesh(name,verts,faces,mat,parent=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);finish(o,name,mat,parent);return o


def lathe(name,profile,mat,parent=None,segments=64,cap=False):
    verts=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for r,z in profile for i in range(segments)]
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    if cap:faces.extend([tuple(reversed(range(segments))),tuple(range((len(profile)-1)*segments,len(profile)*segments))])
    return mesh(name,verts,faces,mat,parent)


def key(o,t,location=None,rotation=None,scale=None):
    frame=round(t*24)
    for attr,val in [('location',location),('rotation_euler',rotation),('scale',scale)]:
        if val is not None:setattr(o,attr,val);o.keyframe_insert(data_path=attr,frame=frame)


rover=group('Rover','rover')
cube('Rover chassis',(0,0,1.02),(1.85,2.15,.6),gold,rover,.1)
cube('Deck',(0,-.02,1.36),(1.96,2.25,.12),white,rover,.04)
for x in [-.73,-.28,.28,.73]:
    cube('Deck instrument',(x,.15,1.48),(.32,.58,.16),white,rover)
    for y in [-.08,.34]:cylinder('Deck fastener',(x,y,1.57),.025,.025,steel,rover,vertices=8)
# Finned RTG at rear; cameras and arm stay stowed during landing.
cylinder('RTG core',(0,1.34,1.15),.22,.75,dark,rover,rotation=(math.pi/2,0,0))
for y in [1.02+i*.075 for i in range(10)]:cube('RTG cooling fin',(0,y,1.15),(.75,.025,.67),steel,rover,.005)
cube('Stowed mast',(0,-.4,1.55),(.25,1.3,.22),white,rover)
cube('Mast camera head',(0,-.98,1.58),(.72,.35,.27),white,rover)
for x in [-.22,.22]:cylinder('Navigation camera',(x,-1.165,1.58),.09,.04,black,rover,rotation=(math.pi/2,0,0))
rod('Stowed arm A',(-.65,-1.14,.95),(.3,-1.18,.72),.075,white,rover)
rod('Stowed arm B',(.3,-1.18,.72),(.76,-.7,.7),.065,steel,rover)
cylinder('Tool turret',(.76,-.7,.7),.19,.22,dark,rover,rotation=(0,math.pi/2,0))
for sign in [-1,1]:
    suspension=group('SuspensionLeft' if sign<0 else 'SuspensionRight',parent=rover);suspension.location=(sign*.8,0,.94)
    pivot=(0,0,0);front=(sign*.42,-1.12,-.64);middle=(sign*.42,0,-.64);rear=(sign*.42,1.08,-.64)
    for a,b in [(pivot,front),(pivot,(sign*.2,.52,-.3)),((sign*.2,.52,-.3),middle),((sign*.2,.52,-.3),rear)]:rod('Rocker bogie link',a,b,.055,steel,suspension)
    for j,pos in enumerate([front,middle,rear]):
        wheel=group(f'Wheel_{sign}_{j}',parent=suspension);wheel.location=pos
        cylinder('Wheel drum',(0,0,0),.28,.28,dark,wheel,rotation=(0,math.pi/2,0),vertices=32)
        cylinder('Wheel hub',(sign*.152,0,0),.15,.025,steel,wheel,rotation=(0,math.pi/2,0))
        cylinder('Hub cap',(sign*.17,0,0),.055,.04,gold,wheel,rotation=(0,math.pi/2,0))
        for k in range(20):
            a=k*math.tau/20
            tread=cube('Tread ridge',(0,.282*math.sin(a),.282*math.cos(a)),(.3,.045,.025),steel,wheel,.004);tread.rotation_euler[0]=-a
    for t,angle in [(0,-sign*.62),(18,-sign*.62),(22,0),(42,0)]:key(suspension,t,rotation=(0,angle,0))

stage=group('DescentStage','descent')
cube('Descent frame',(0,0,.18),(2.7,2.45,.33),gold,stage,.12)
cube('Central attachment',(0,0,-.13),(1.3,1.45,.23),steel,stage,.04)
for x in [-1.05,1.05]:
    for y in [-.88,.88]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.38,location=(x,y,.5));o=bpy.context.object;o.scale=(1,.75,1);finish(o,'Propellant tank',white,stage)
# Four outboard pairs: eight thrusters; plumes kept outside the rover footprint.
plumes=[]
for sign in [-1,1]:
    for y in [-.9,.9]:
        rod('Engine outrigger',(sign*1.1,y,.1),(sign*1.9,y,-.07),.07,steel,stage)
        for d in [-.18,.18]:
            x=sign*1.88; yy=y+d
            nozzle=lathe('Engine nozzle',[(.07,.05),(.09,-.15),(.2,-.42)],dark,stage,24);nozzle.location=(x,yy,0)
            cylinder('Engine valve',(x,yy,.15),.095,.2,steel,stage)
            plume=lathe('Exhaust',[ (.13,-.44),(.065,-1.5),(.005,-2.3)],flame,stage,16,True);plume.location=(x,yy,0);plumes.append(plume)
            for t,s in [(0,.001),(9.9,.001),(10.2,1),(31,1),(38,1),(40,.001),(42,.001)]:key(plume,t,scale=(1,1,s))

back=group('Backshell','backshell')
lathe('Backshell wall',[(2.65,-2.3),(2.65,-.3),(2.1,.65),(.8,1.6),(.42,1.85)],white,back)
lathe('Backshell inner edge',[(2.61,-2.3),(2.65,-2.3)],steel,back)
for i in range(12):
    a=i*math.tau/12
    rod('Aeroshell rib',(2.64*math.cos(a),2.64*math.sin(a),-.3),(.44*math.cos(a),.44*math.sin(a),1.8),.018,steel,back)
heat=group('HeatShield','heatshield')
lathe('Heat shield bowl',[(0,-.65),(1,-.56),(2.65,-.15),(2.65,0),(0,-.4)],shieldmat,heat,64,True)
lathe('Heat shield rim',[(2.65,-.15),(2.65,-.03),(2.61,.01)],steel,heat)
for a in range(0,360,30):
    q=math.radians(a);rod('Shield tile seam',(.15*math.cos(q),.15*math.sin(q),-.635),(2.63*math.cos(q),2.63*math.sin(q),-.15),.008,gold,heat)

parachute=group('Parachute','parachute')
# Disk-gap-band schematic: upper canopy, open annular gap, lower vertical band.
segments=48;R=3.3
verts=[];faces=[]
for j in range(9):
    theta=.10+(math.pi/2-.10)*j/8
    for i in range(segments):
        a=i*math.tau/segments;r=R*math.sin(theta);verts.append((r*math.cos(a),r*math.sin(a),1.65*math.cos(theta)))
for j in range(8):
    for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
canopy=mesh('Parachute disk',verts,faces,cloth,parachute);canopy.data.materials.append(red)
for f in canopy.data.polygons:f.material_index=(f.index%segments//4)%2
band=lathe('Parachute band',[(3.26,-.28),(2.96,-.9)],cloth,parachute,48);band.data.materials.append(red)
for f in band.data.polygons:f.material_index=(f.index//4)%2
for i in range(24):
    a=i*math.tau/24
    rod('Canopy gap webbing',(3.29*math.cos(a),3.29*math.sin(a),0),(3.26*math.cos(a),3.26*math.sin(a),-.28),.014,cord,parachute)
    rod('Parachute suspension line',(2.96*math.cos(a),2.96*math.sin(a),-.9),(.12*math.cos(a),.12*math.sin(a),-5),.009,cord,parachute)

# Cables are authored as animated meshes, including changing length and direction.
bridles=[]
for i,(x,y) in enumerate([(-.65,-.62),(.65,-.62),(0,.7)]):
    o=cylinder(f'Bridle_{i}',(0,0,0),.018,1,cord,vertices=10);o['part']='bridle';bridles.append((o,x,y))
umb=cylinder('Umbilical',(0,0,0),.026,1,dark,vertices=10);umb['part']='bridle';bridles.append((umb,.18,.72))

# Prescribed teaching positions; heights deliberately compressed, not flight simulation.
keys=[(0,10,11.85,-2.5),(4,9.5,11.35,-2.2),(8,9,10.85,-2),(10,8.6,10.45,-1.8),(14,6.8,8.65,-1),(18,6.8,8.65,0),(22,4.7,8.65,0),(28,1.5,8.65,0),(32,0,8.05,0),(34,0,8.05,0),(39,0,12,7),(42,0,16,15)]
for t,rz,sz,x in keys:
    key(rover,t,location=(x if t<18 else 0,0,rz))
    key(stage,t,location=(x,0,sz),rotation=(0,math.radians(-18 if t>=39 else 0),0))
    for o,cx,cy in bridles:
        top=Vector((x+cx,cy,sz-.25));bottom=Vector((cx+(x if t<18 else 0),cy,rz+1.42));v=top-bottom
        key(o,t,location=(top+bottom)/2,rotation=v.to_track_quat('Z','Y').to_euler(),scale=(1,1,v.length) if 18<=t<=32 else (.0001,.0001,.0001))
# Keep cables hidden before winch deployment and cut them directly after contact.
for o,cx,cy in bridles:
    for t in [0,4,8,10,14,17.95]:
        scene.frame_set(round(t*24));o.scale.z=.0001;o.keyframe_insert('scale',frame=round(t*24))
    scene.frame_set(32*24);length=o.scale.z
    key(o,32,scale=(1,1,length));key(o,32.18,scale=(.001,.001,.0001));key(o,42,scale=(.001,.001,.0001))
for t,x,z in [(0,-2.5,12.2),(4,-2.2,11.7),(8,-2,11.2),(10,-1.8,10.8),(14,-5,12),(18,-9,13.5),(28,-15,13),(42,-22,9)]:
    key(back,t,location=(x,0,z));key(parachute,t,location=(x,0,z+6.9))
for t,x,z,angle in [(0,-2.5,9.9,0),(4,-2.2,9.4,0),(5,-2.3,7.5,.1),(8,-4,4,.4),(12,-22,-1,.8),(42,-22,-1,.8)]:key(heat,t,location=(x,0,z),rotation=(0,angle,0))
# Export linear interpolation for deterministic scrubbing and no spline overshoot below ground.
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        action=o.animation_data.action
        if hasattr(action,'fcurves'):
            for fc in action.fcurves:
                for k in fc.keyframe_points:k.interpolation='LINEAR'

terrain=group('Terrain')
# Circular diorama with a flat touchdown patch and low terrain outside it.
N=88;verts=[(0,0,0)];rings=12
for ring in range(1,rings+1):
    r=19*ring/rings
    for i in range(N):
        a=i*math.tau/N;x=r*math.cos(a);y=r*math.sin(a)
        height=max(0,min(1,(r-4)/7))*(.27*math.sin(x*.6)+.21*math.cos(y*.7)+.12*math.sin(x+y))
        verts.append((x,y,height))
faces=[(0,1+i,1+(i+1)%N) for i in range(N)]
for ring in range(rings-1):
    for i in range(N):a=1+ring*N+i;b=1+ring*N+(i+1)%N;faces.append((a,a+N,b+N,b))
mesh('Mars terrain surface',verts,faces,soil,terrain)
lathe('Diorama edge',[(19,-.55),(19,0)],soil,terrain,88)
for i in range(76):
    x=random.uniform(-16,16);y=random.uniform(-16,16)
    if math.hypot(x,y)<4 or math.hypot(x,y)>17:continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,.04));o=bpy.context.object;o.scale=(random.uniform(.12,.5),random.uniform(.12,.6),random.uniform(.12,.38));finish(o,'Basalt fragment',rockmat,terrain)

scene.frame_set(25*24)
# Simple lighting and camera also support a deterministic source render.
bpy.ops.object.light_add(type='AREA', location=(-8,-9,20));light=bpy.context.object;light.name='Studio key';light.data.energy=2400;light.data.shape='DISK';light.data.size=12
bpy.ops.object.light_add(type='AREA',location=(9,6,13));bpy.context.object.data.energy=1400;bpy.context.object.data.size=10
bpy.ops.object.camera_add(location=(17,-23,16));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=24;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'poster.png')
scene.view_settings.view_transform='AgX'
scene['asset_id']='mars2020-descent-v1';scene['provenance']='Original procedural Blender model, NASA-informed qualitative teaching schematic; not mission CAD or telemetry.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mars-landing.blend'),compress=True)
# Scene mode combines keyed objects into one synchronized timeline.
bpy.ops.export_scene.gltf(filepath=str(OUT/'mars-landing.glb'),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='SCENE',export_anim_scene_split_object=False,export_force_sampling=True,export_frame_range=True,export_cameras=False,export_lights=False,export_apply=True)
if opts.render:bpy.ops.render.render(write_still=True)
meta={'asset_id':'mars2020-descent-v1','blender_version':bpy.app.version_string,'duration_seconds':42,'fps':24,'geometry':'original authored procedural mesh','animation':'Blender keyframes exported to glTF; linear, prescribed and time-compressed','source_script':'scripts/mars-landing/build_scene.py','parts':['Rover','DescentStage','Backshell','HeatShield','Parachute'],'wheels':6,'engines':8,'support_cables':3,'additional_umbilical':1,'units':'Model length uses metre-sized geometry; trajectory distances are deliberately compressed.','sources':['https://science.nasa.gov/resource/powered-descent-for-perseverance-illustration/','https://science.nasa.gov/resource/perseverance-heat-shield-separation-illustration/','https://science.nasa.gov/resource/perseverance-touching-down-on-mars-illustration/']}
for name in ['mars-landing.glb','mars-landing.blend']:
    data=(OUT/name).read_bytes();meta[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('MARS_ASSET_COMPLETE '+json.dumps(meta))
