"""Assemble selected CC0 Quaternius parts with original Bellweather costume additions."""
import bpy,bmesh,pathlib,sys,math
from mathutils import Vector,Matrix
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import importlib.util
spec=importlib.util.spec_from_file_location('artbuild',pathlib.Path(__file__).with_name('art-build.py'));art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
ROOT=art.ROOT
def source(pattern):return next((ROOT/'art/vendor').glob(pattern))
def load(pattern):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(source(pattern)));return list(set(bpy.data.objects)-before)
art.reset()
obs=load('**/Superhero_Female_FullBody.gltf');rig=next(o for o in obs if o.type=='ARMATURE');rig.name='MageRig'
base=next(o for o in obs if o.name=='Superhero_Female')
# Keep the expressive face/neck only; clothing supplies the complete body and hands.
bm=bmesh.new();bm.from_mesh(base.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.44],context='VERTS');bm.to_mesh(base.data);bm.free();base.name='Face and neck'
for m in bpy.data.materials:
    if m.use_nodes:
        for n in list(m.node_tree.nodes):
            if n.type=='NORMAL_MAP':m.node_tree.nodes.remove(n)
def use_rig(obs):
    for o in obs:
        if o.type=='MESH':
            o.parent=rig
            for mod in o.modifiers:
                if mod.type=='ARMATURE':mod.object=rig
    for o in obs:
        if o.type=='ARMATURE':bpy.data.objects.remove(o,do_unlink=True)
clothes=load('**/Outfits/Female_Peasant.gltf'); meshes=[o for o in clothes if o.type=='MESH']; use_rig(clothes); clothes=meshes
hair=load('**/Origin at 0/glTF (Godot)/Hair_Buns.gltf')
identity=art.mat('Identity',(.10,.48,.46),texture=True)
# Neutral wash multiplied by a factor: runtime material.color can choose teal or coral.
tex=next(n for n in identity.node_tree.nodes if n.type=='TEX_IMAGE')
pixels=list(tex.image.pixels)
for i in range(0,len(pixels),4):
    v=min(1,pixels[i+1]/.48);pixels[i:i+3]=[v,v,v]
tex.image.pixels=pixels;tex.image.pack()
mix=identity.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.10,.48,.46,1)
identity.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);identity.node_tree.links.new(mix.outputs[0],identity.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
gold=art.mat('Embroidery and brass',(.78,.51,.19),.35)
ink=art.mat('Ink blue wool',(.042,.095,.15),texture=True)
leather=art.mat('Warm leather',(.25,.115,.055),texture=True)
cream=art.mat('Linen facing',(.89,.79,.54),texture=True)
for o in clothes:
    if o.type!='MESH':continue
    if 'Body' in o.name:
        o.data.materials.clear();o.data.materials.append(identity)
    if 'Legs' in o.name:o.data.materials.clear();o.data.materials.append(ink)
    if 'Feet' in o.name:o.data.materials.clear();o.data.materials.append(leather)
def bind(o,bone):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.parent=rig;g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Mage deformation','ARMATURE');mod.object=rig
    return o
for o in hair:
    if o.type=='MESH':
        o.data.materials.clear();o.data.materials.append(leather);bind(o,'Head')
# Asymmetric brim and curved pointed crown make the silhouette personal.
brim=art.cyl('Traveler brim',(0,.015,1.735),.285,.045,identity,48);brim.scale.y=.85;bind(brim,'Head')
verts=[];faces=[];rings=[(1.74,.19,0),(1.84,.17,0),(1.97,.12,.025),(2.09,.064,.080),(2.12,.005,.15)]
for z,r,offset in rings:
    for i in range(32):a=i/32*math.tau;verts.append((offset+r*math.cos(a),.015+r*math.sin(a),z))
for j in range(len(rings)-1):
    for i in range(32):a=j*32+i;b=j*32+(i+1)%32;faces.append((a,b,b+32,a+32))
mesh=bpy.data.meshes.new('Bent tailored crown');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Bent tailored crown',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(identity);bind(o,'Head')
bind(art.torus('Hat band',(0,.015,1.77),.177,.017,gold),'Head')
bind(art.sphere('Hat enamel pin',(.055,-.168,1.79),(.032,.018,.042),cream),'Head')
# Capelet is short, so trousers, hands and face remain readable.
cape=art.dome('Short scholar capelet',(0,.025,1.39),.27,.08,ink);cape.scale.y=.72;bind(cape,'spine_03')
for sign in [-1,1]:
    pts=[(sign*.065,-.153,1.37),(sign*.095,-.165,1.24),(sign*.12,-.145,1.1)]
    bind(art.curve('Gold lapel stitching',pts,.010,gold),'spine_03')
bind(art.sphere('Brooch',(0,-.169,1.28),(.035,.014,.035),gold),'spine_03')
book=art.cube('Personal spellbook',(.22,-.02,.99),(.065,.17,.23),leather,.01);book.rotation_euler.y=-.16;bind(book,'spine_01')
bind(art.cube('Spellbook pages',(.224,-.025,.99),(.07,.145,.19),cream,.006),'spine_01')
# Import only free in-place clips; matching deformation-bone names and rest axes.
animobs=load('**/Unreal-Godot/UAL1_Standard.glb')
for o in animobs:bpy.data.objects.remove(o,do_unlink=True)
selected={'Idle_Loop':'Idle','Walk_Loop':'Walk','Spell_Simple_Shoot':'Cast','Sprint_Loop':'Sprint'}
actions=[]
for action in list(bpy.data.actions):
    if action.name not in selected:bpy.data.actions.remove(action);continue
    action.name=selected[action.name];action.use_fake_user=True;actions.append(action)
rig.animation_data_create();idle=next(a for a in actions if a.name=='Idle');rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0]
bpy.context.scene.frame_set(int(idle.frame_range[0]));bpy.context.view_layer.update()
carry={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones if b.name.endswith('_r')}
# Keep the staff arm in its carry pose while the other arm performs the licensed cast.
# Baked deformation channels retain this change without runtime skeletal overrides.
original_cast=next(a for a in actions if a.name=='Cast');frames=[]
rig.animation_data.action=original_cast;rig.animation_data.action_slot=original_cast.slots[0]
for frame in range(int(original_cast.frame_range[0]),int(original_cast.frame_range[1])+1):
    bpy.context.scene.frame_set(frame);frames.append((frame,{b.name:carry.get(b.name,(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy())) for b in rig.pose.bones}))
original_cast.name='Source Cast temporary';cast=bpy.data.actions.new('Cast');cast.use_fake_user=True;rig.animation_data.action=cast
for frame,poses in frames:
    for name,(location,rotation,scale) in poses.items():
        b=rig.pose.bones[name];b.location=location;b.rotation_mode='QUATERNION';b.rotation_quaternion=rotation;b.scale=scale
        b.keyframe_insert(data_path='location',frame=frame);b.keyframe_insert(data_path='rotation_quaternion',frame=frame);b.keyframe_insert(data_path='scale',frame=frame)
actions.remove(original_cast);bpy.data.actions.remove(original_cast);actions.append(cast)
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(int(idle.frame_range[0]));bpy.context.view_layer.update()
# Staff built in a neutral carry orientation then converted into the binding pose.
hand=rig.pose.bones['hand_r'];pos=hand.matrix.translation.copy();staff=[]
staff.append(art.cyl('Rowan staff',(pos.x,pos.y,pos.z+.13),.022,1.36,leather,12))
staff.append(art.torus('Staff open circle',(pos.x,pos.y,pos.z+.87),.12,.022,gold,(math.pi/2,0,0)))
staff.append(art.sphere('Staff lantern',(pos.x,pos.y,pos.z+.87),(.06,.06,.09),identity))
transform=rig.data.bones['hand_r'].matrix_local @ hand.matrix.inverted()
for o in staff:
    o.matrix_world=transform@o.matrix_world;bind(o,'hand_r')
# NLA track names become stable exported clip names; no entire library shipped.
rig.animation_data.action=None
for action in actions:
    track=rig.animation_data.nla_tracks.new();track.name=action.name;strip=track.strips.new(action.name,int(action.frame_range[0]),action);strip.action_slot=action.slots[0]
    track.mute=True
for img in bpy.data.images:
    if img.has_data:
        if max(img.size)>512:
            factor=512/max(img.size);img.scale(max(1,round(img.size[0]*factor)),max(1,round(img.size[1]*factor)))
        img.pack()
bpy.context.scene.frame_set(1)
bpy.ops.outliner.orphans_purge(do_recursive=True)
if '--save-source' in sys.argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/wizard.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/wizard.glb'),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips_merged_animation_name='Idle',export_bake_animation=True)
print('EXPORTED WIZARD')


