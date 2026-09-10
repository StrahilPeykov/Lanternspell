"""Original Bellweather landmark + costume assembly. Blender 5.2, run from project root."""
import bpy, math, random, pathlib, json
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'; OUT.mkdir(parents=True,exist_ok=True)
ART=ROOT/'art'; ART.mkdir(exist_ok=True)
random.seed(41)
def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,texture=False):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.77;p.inputs['Metallic'].default_value=metal
    if texture:
        size=128; img=bpy.data.images.new(name+' painted wash',width=size,height=size); pix=[]
        for y in range(size):
            for x in range(size):
                v=.89+.065*math.sin(x*.12+y*.041)+.045*math.cos(y*.18)+random.random()*.025
                pix.extend([min(1,c*v) for c in color]+[1])
        img.pixels=pix; img.pack(); tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m
def finish(o,name,m):
    o.name=name;o.data.materials.append(m);return o
def cube(name,loc,scale,m,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft carved edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,m)
def cyl(name,loc,r,depth,m,verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);return finish(bpy.context.object,name,m)
def sphere(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=scale;finish(o,name,m)
    for p in o.data.polygons:p.use_smooth=True
    return o
def torus(name,loc,r,t,m,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=48,minor_segments=8,location=loc,rotation=rotation);return finish(bpy.context.object,name,m)
def curve(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def dome(name,loc,r,h,m):
    verts=[];faces=[]; n=48; rings=12
    for j in range(rings+1):
        theta=j/rings*math.pi/2
        for i in range(n):
            a=i/n*math.tau;verts.append((loc[0]+r*math.cos(theta)*math.cos(a),loc[1]+r*math.cos(theta)*math.sin(a),loc[2]+h*math.sin(theta)))
    for j in range(rings):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,m)
    # UVs deliberately broad: brushed stripes survive export as packed image texture.
    uv=mesh.uv_layers.new()
    for poly in mesh.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index;uv.data[li].uv=((vi%n)/n,(vi//n)/rings)
    return o
def export(name,join=False):
    if join:
        for o in list(bpy.context.scene.objects):
            if o.type=='CURVE':
                bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        # Merge each shared material group to bound draw calls while retaining orrery parts.
        groups={}
        for o in list(bpy.context.scene.objects):
            if o.type=='MESH':groups.setdefault(o.active_material.name,[]).append(o)
        for k,obs in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs:o.select_set(True)
            bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=k+' architecture'
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_bake_animation=True)
def observatory():
    reset();stone=mat('Ivory limewash',(.84,.73,.52),texture=True);trim=mat('Pale carved limestone',(.95,.85,.65),texture=True);slate=mat('Blue slate painted',(.075,.24,.31),texture=True);gold=mat('Aged brass',(.65,.38,.10),.55);wood=mat('Honey cedar',(.29,.13,.057),texture=True);glass=mat('Sleeping turquoise glass',(.085,.30,.34),.2);dark=mat('Window recess',(.028,.067,.088));rose=mat('Terracotta',(.58,.22,.12),texture=True)
    cyl('Round foundation',(0,0,.2),4.8,.4,trim)
    cyl('Tower plaster',(0,0,2.8),3.65,5.2,stone,48)
    for z,r in [(.48,3.85),(1.05,3.73),(5.05,3.82),(5.4,3.98)]:cyl('Masonry cornice',(0,0,z),r,.16,trim,48)
    dome('Copper blue dome',(0,0,5.5),4.05,2.85,slate)
    for i in range(12):
        a=math.tau*i/12
        curve('Dome meridian',[(4.08*math.cos(t)*math.cos(a),4.08*math.cos(t)*math.sin(a),5.51+2.86*math.sin(t)) for t in [j*math.pi/2/18 for j in range(19)]],.035,gold)
    cyl('Lantern drum',(0,0,8.3),.65,.65,trim);dome('Lantern cap',(0,0,8.6),.86,.62,slate)
    for i in range(8):
        a=math.tau*i/8;cyl('Lantern pillar',(.57*math.cos(a),.57*math.sin(a),8.45),.055,.6,gold,8)
    sphere('Sleeping star',(0,0,9.35),(.17,.17,.17),gold)
    # Door faces local -Y, which is exported +Z toward the courtyard.
    cube('Entry recess',(0,-3.65,1.7),(2.15,.24,2.7),dark)
    cube('Cedar double doors',(0,-3.80,1.57),(1.72,.18,2.65),wood)
    for x in [-1.1,1.1]:cube('Door pilaster',(x,-3.89,1.65),(.27,.38,2.9),trim)
    curve('Entry arch',[(1.11*math.cos(t),-3.90,3.08+1.11*math.sin(t)) for t in [i*math.pi/32 for i in range(33)]],.15,trim)
    for x in [-.68,-.34,0,.34,.68]:cube('Door plank seam',(x,-3.903,1.7),(.018,.013,2.5),gold,.0)
    torus('Door brass ring',(.20,-3.94,1.5),.11,.025,gold,(math.pi/2,0,0))
    for j in range(3):cube('Welcoming steps',(0,-4.25-j*.37,.37-j*.10),(3.0+j*.45,.85,.18),trim)
    for i in [-2,-1,1,2,3,4]:
        a=i*math.pi/4; x=3.61*math.sin(a);y=-3.61*math.cos(a)
        parent=bpy.data.objects.new('Window assembly',None);bpy.context.collection.objects.link(parent);parent.location=(x,y,2.9);parent.rotation_euler[2]=a
        obs=[cube('Window deep reveal',(0,0,0),(1.15,.2,1.8),dark),cube('Turquoise window',(0,-.13,0),(.84,.09,1.52),glass),cube('Window sill',(0,-.2,-.96),(1.4,.45,.18),trim)]
        for px in [-.57,.57]:obs.append(cube('Stone window frame',(px,-.14,0),(.14,.20,1.96),trim))
        for zz in [-.86,.86]:obs.append(cube('Stone window lintel',(0,-.14,zz),(1.24,.20,.14),trim))
        obs.append(cube('Window mullion',(0,-.20,0),(.045,.05,1.55),gold))
        for o in obs:o.parent=parent
    # Paired low study wings avoid an isolated combat-tower silhouette.
    for sign in [-1,1]:
        x=sign*4.1;cube('Study wing',(x,.9,1.62),(2.4,3.6,2.9),stone);cube('Wing roof',(x,.9,3.14),(2.75,4,.25),slate)
        for z in [.36,3.02]:cube('Wing cornice',(x,.9,z),(2.6,3.8,.16),trim)
        for j in [-1,1]:cube('Wing window',(x+sign*1.22,.9+j*.8,1.8),(.07,.7,1.3),glass)
        cube('Flower trough',(x,-1.1,.7),(1.8,.45,.55),rose)
        for j in range(7):sphere('Rounded window herbs',(x-.72+j*.24,-1.1,1.10+random.random()*.18),(.20,.22,.23),slate)
    export('observatory',True)
if __name__=='__main__':observatory()
