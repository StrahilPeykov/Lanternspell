"""Original benchmark architecture, Atlas, and bone-attach costume accessories.
Run with Blender --background --python scripts/benchmark-art.py. No source .blend rewrite.
"""
import bpy,math,pathlib,importlib.util,random,sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('artbuild',pathlib.Path(__file__).with_name('art-build.py'));a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
random.seed(81);OUT=ROOT/'public/assets'
COURTYARD_DETAIL=False
def at(x,y,z):return (x,-z,y)
def group(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def box(name,x,y,z,w,h,d,m,bevel=.035):
 if not COURTYARD_DETAIL:return a.cube(name,at(x,y,z),(w,d,h),m,bevel)
 o=a.cube(name,at(x,y,z),(w,d,h),m,0)
 if bevel:
  mod=o.modifiers.new('Single carved bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def ball(name,x,y,z,sx,sy,sz,m):
 if not COURTYARD_DETAIL:return a.sphere(name,at(x,y,z),(sx,sz,sy),m)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=at(x,y,z));o=bpy.context.object;o.scale=(sx,sz,sy);a.finish(o,name,m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,pts,r,m):
 o=a.curve(name,[at(*p) for p in pts],r,m)
 if COURTYARD_DETAIL:o.data.bevel_resolution=0
 return o
def ring(name,x,y,z,r,t,m,axis='y'):
 rot=(0,0,0) if axis=='y' else ((math.pi/2,0,0) if axis=='z' else (0,math.pi/2,0))
 if not COURTYARD_DETAIL:return a.torus(name,at(x,y,z),r,t,m,rot)
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=32,minor_segments=6,location=at(x,y,z),rotation=rot)
 return a.finish(bpy.context.object,name,m)
def column(name,x,y,z,r,h,m,n=16):return a.cyl(name,at(x,y,z),r,h,m,n)
def palette():
 return {k:a.mat(k,c,metal,True) for k,c,metal in [
 ('Benchmark limestone',(.87,.74,.53),0),('Benchmark carved edge',(.96,.86,.67),0),('Benchmark slate',(.058,.19,.255),0),
 ('Benchmark ink',(.035,.075,.095),0),('Benchmark wood',(.29,.135,.055),0),('Benchmark brass',(.71,.43,.12),.45),
 ('Benchmark moss',(.20,.31,.13),0),('Benchmark coral',(.64,.25,.16),0),('Benchmark parchment',(.89,.78,.50),0),
 ('Benchmark lagoon',(.085,.45,.43),.15)]}
def mesh(name,verts,faces,m):
 data=bpy.data.meshes.new(name);data.from_pydata([at(*v) for v in verts],[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 uv=data.uv_layers.new()
 for poly in data.polygons:
  for li in poly.loop_indices:
   v=verts[data.loops[li].vertex_index];uv.data[li].uv=(v[0]*.37+v[2]*.41,v[1]*.41)
 return o
def batch_export(name,preserve=()):
 for o in list(bpy.context.scene.objects):
  if o.type=='CURVE':
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 buckets={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':buckets.setdefault((o.parent.name if o.parent else '',o.active_material.name),[]).append(o)
 for (parent,material),obs in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0]
  if len(obs)>1:bpy.ops.object.join()
  obs[0].name=(parent+' ' if parent else '')+material
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_animations=False,export_extras=True)
 print('BENCHMARK EXPORTED',name)
def arch_segment(name,cx,cy,cz,r,thickness,depth,t0,t1,m,axis='z'):
 v=[]
 for dep in [-depth/2,depth/2]:
  for rr in [r,r+thickness]:
   for t in [t0,t1]:
    u=rr*math.cos(t);h=rr*math.sin(t)
    v.append((cx+u,cy+h,cz+dep) if axis=='z' else (cx+dep,cy+h,cz+u))
 return mesh(name,v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],m)
def arch(cx,cy,cz,r,thickness,depth,m,axis='z',segments=13):
 for i in range(segments):arch_segment('Cut arch voussoir',cx,cy,cz,r,thickness,depth,i*math.pi/segments+.009,(i+1)*math.pi/segments-.009,m,axis)
def transom(cx,cy,cz,r,m,axis='x'):
 verts=[(cx,cy,cz)]
 for i in range(25):
  t=i*math.pi/24;u=r*math.cos(t);h=r*math.sin(t)
  verts.append((cx,cy+h,cz+u) if axis=='x' else (cx+u,cy+h,cz))
 return mesh('Recessed arched transom',verts,[(0,i+1,i+2) for i in range(24)],m)
def banner(x,y,z,m,trim,axis='z'):
 vs=[(x-.38,y,z),(x+.38,y,z),(x+.34,y-1.65,z+.035),(x,y-1.94,z+.06),(x-.34,y-1.65,z+.035)]
 if axis=='x':vs=[(x+(q[2]-z),q[1],z+(q[0]-x)) for q in vs]
 mesh('College swallowtail banner',vs,[(0,1,2,3,4)],m)
 # inset embroidery visible at gameplay scale, no baked text
 if axis=='z':
  tube('Banner border',[(x-.29,y-.1,z+.02),(x-.27,y-1.58,z+.055),(x,y-1.82,z+.08),(x+.27,y-1.58,z+.055),(x+.29,y-.1,z+.02)],.012,trim)
  ring('Banner college wheel',x,y-.75,z+.05,.22,.014,trim,'z')
 else:
  tube('Banner border',[(x+.025,y-.1,z-.29),(x+.055,y-1.58,z-.27),(x+.08,y-1.82,z),(x+.055,y-1.58,z+.27),(x+.025,y-.1,z+.29)],.012,trim)
  ring('Banner college wheel',x+.05,y-.75,z,.22,.014,trim,'x')
def book(x,y,z,w,d,h,m,ink):
 box('Book pages',x,y,z,w,h,d,m,.008)
 for sy in [-1,1]:box('Book board',x,y+sy*h/2,z,w+.035,.025,d+.035,ink,.005)
 box('Book spine',x-w/2,y,z,.035,h,d+.035,ink,.005)
def courtyard():
 global COURTYARD_DETAIL
 COURTYARD_DETAIL=True
 a.reset();p=palette();stone=p['Benchmark limestone'];edge=p['Benchmark carved edge'];slate=p['Benchmark slate'];dark=p['Benchmark ink'];wood=p['Benchmark wood'];gold=p['Benchmark brass'];paper=p['Benchmark parchment'];moss=p['Benchmark moss'];coral=p['Benchmark coral']
 # The existing six wings are replaced by continuous inward-facing arcaded studies.
 for side in [-1,1]:
  for z in [-13,-5,3]:
   x=side*11;inner=side*8.55
   box('Study plaster mass',x,2.5,z,4.5,5,7.4,stone,.07)
   for h in [.20,4.75,5.02]:box('Continuous cornice',x,h,z,4.72,.17,7.60,edge)
   # Actual sloped roof with two long faces and gable end triangulation.
   vv=[(x-2.5,5.1,z-3.92),(x+2.5,5.1,z-3.92),(x,6.45,z-3.92),(x-2.5,5.1,z+3.92),(x+2.5,5.1,z+3.92),(x,6.45,z+3.92)]
   mesh('Blue pitched study roof',vv,[(0,3,5,2),(2,5,4,1),(0,2,1),(3,4,5)],slate)
   tube('Roof ridge',[(x,6.48,z-4),(x,6.48,z+4)],.055,gold)
   # Cheap raised courses create illustrated tiled depth without hundreds of meshes.
   for t in [.25,.50,.75]:
    xx=x+side*2.5*t;yy=6.45-1.35*t;tube('Slate tile course',[(xx,yy+.025,z-3.90),(xx,yy+.025,z+3.90)],.018,edge)
   box('Chimney',x+side*.8,6.1,z-2.0,.52,1.5,.7,stone);box('Chimney cap',x+side*.8,6.84,z-2,.68,.13,.88,edge)
   # Inward openings have real segmented arches and a recessed dark tympanum.
   for zz in [z-1.85,z+1.85]:
    box('Recessed oak study door',inner,1.50,zz,.10,2.75,1.66,dark)
    for s in [-1,1]:
     box('Opening carved jamb',inner-side*.08,1.43,zz+s*.94,.27,2.86,.17,edge)
     box('Opening plinth',inner-side*.13,.18,zz+s*.94,.39,.36,.33,edge)
    arch(inner-side*.11,2.84,zz,.86,.22,.26,edge,'x')
    # Opaque warm glazing, painted in the same parchment wash as the college books.
    # These surfaces sit behind the existing mullions. No transparent windows,
    # extra point lights or modeled rooms are needed to suggest inhabited studies.
    box('Warm study glazing',inner-side*.057,1.72,zz,.015,2.30,1.58,paper,0)
    transom(inner-side*.085,2.84,zz,.86,paper)
    for t in [math.pi/4,math.pi/2,math.pi*3/4]:tube('Transom fanlight',[(inner-side*.12,2.84,zz),(inner-side*.12,2.84+.83*math.sin(t),zz+.83*math.cos(t))],.018,gold)
    # Arch interior radial glazing.
    for j in range(3):box('Oak vertical mullion',inner-side*.09,1.62,zz-.48+j*.48,.055,2.58,.048,gold,.007)
    for h in [.84,1.65,2.50]:box('Oak crossbar',inner-side*.10,h,zz,.055,.05,1.68,gold,.007)
    # Alternate book-filled reading windows with gathered curtains, so the
    # repeated facade has a practical use rather than twelve identical voids.
    if (int((z+13)/8)+(1 if zz>z else 0)+(1 if side>0 else 0))%2==0:
     box('Lower study bookcase',inner-side*.13,.72,zz,.09,.96,1.57,wood,.012)
     for shelf in [.42,.82]:
      box('Study shelf front',inner-side*.205,shelf,zz,.12,.055,1.61,gold,.008)
      for j in range(7):
       hh=.22+.055*((j+int(shelf*10))%3)
       box('Collected study volumes',inner-side*.19,shelf+.045+hh/2,zz-.66+j*.21,.08,hh,.14,[coral,slate,paper,moss][j%4],.004)
    else:
     for sign in [-1,1]:
      xx=inner-side*.13
      mesh('Gathered study curtain',[(xx,2.79,zz+sign*.78),(xx,2.79,zz+sign*.25),(xx-side*.035,1.63,zz+sign*.60),(xx,1.1,zz+sign*.71)],[(0,1,2,3)],coral)
      tube('Curtain cord',[(xx-side*.04,1.65,zz+sign*.50),(xx-side*.04,1.60,zz+sign*.73)],.015,gold)
     for j in range(3):box('Books left on window sill',inner-side*.18,.61+j*.08,zz-.32,.23,.06,.50-j*.07,paper if j%2 else slate,.007)
   # Hanging college banners between studies, on inward-facing wall.
   banner(inner-side*.22,4.48,z,slate,gold,'x')
   # Deep arcade uprights and capped capitals interrupt the flat frontage.
   for zz in [z-3.68,z+3.68]:
    box('Arcade buttress',inner-side*.15,2.2,zz,.53,4.4,.48,edge)
    box('Arcade capital',inner-side*.16,4.32,zz,.68,.25,.70,edge)
   # Ivy: merged small pointed leaves, never transparent alpha planes.
   tube('Ivy woody vine',[(inner-side*.33,1.4,z-3.3),(inner-side*.35,2.1,z-3.1),(inner-side*.33,2.9,z-3.45),(inner-side*.32,4.2,z-3.18)],.014,moss)
   for j in range(24):
    zz=z-3.4+random.random()*1.2;yy=1.5+random.random()*2.7;xx=inner-side*.32
    mesh('Wall ivy leaves',[(xx,yy,zz-.12),(xx-side*.025,yy+.16,zz),(xx,yy,zz+.13),(xx-side*.06,yy-.14,zz)],[(0,1,2,3)],moss)
 # Central social anchor: book-dial basin. Keeps two clear routes around it.
 column('Dial fountain step',0,.10,3,1.36,.20,edge,40);column('Dial fountain plinth',0,.38,3,1.14,.48,stone,40)
 ring('Carved basin lip',0,.67,3,1.12,.12,edge);column('Still dark reflecting water',0,.63,3,1.00,.035,p['Benchmark lagoon'],40)
 column('Dial pillar',0,1.03,3,.25,.76,stone);ring('Vertical dial wheel',0,1.62,3,.58,.038,gold,'z');ring('Diagonal dial wheel',0,1.62,3,.46,.025,gold,'x')
 mesh('Sundial index',[(0,1.10,3),(.42,1.11,3),(0,1.97,3)],[(0,1,2)],gold)
 for i in range(12):
  t=i*math.tau/12;ball('Dial hour stud',1.12*math.cos(t),.79,3+1.12*math.sin(t),.042,.04,.042,gold)
 # Broad clock-like dial marks make the social anchor legible from the follow
 # camera. The water and unlit armillary remain calm until the chapter wakes.
 for i in range(8):
  t=i*math.tau/8
  tube('Dial brass measuring rays',[(.73*math.cos(t),.654,3+.73*math.sin(t)),(.94*math.cos(t),.654,3+.94*math.sin(t))],.014,gold)
 # Optional reading pocket in the reachable southern west corner.
 for x in [-11.45,-8.50]:
  box('Reading bench seat',x,.55,10.4,.48,.14,2.20,wood)
  box('Reading bench back',x+(-.18 if x< -10 else .18),1.03,10.4,.11,.78,2.2,wood)
  for zz in [9.57,11.23]:box('Bench carved leg',x,.28,zz,.30,.56,.15,stone)
  for zz in [9.45,11.35]:box('Bench arm rest',x,.87,zz,.58,.095,.12,wood)
  box('Bench woven cushion',x,.66,10.0,.45,.10,.71,slate,.045)
  for zz in [9.73,10.27]:box('Cushion woven stripe',x,.716,zz,.45,.008,.025,paper,.002)
 column('Pocket reading table',-10,.73,10.5,.66,.11,wood,24);column('Table pedestal',-10,.38,10.5,.12,.68,wood)
 book(-10,.86,10.5,.55,.38,.15,paper,slate);book(-10.08,1,10.5,.50,.32,.1,paper,coral)
 column('Keeper tea cup',-9.70,.93,10.13,.095,.18,edge,12);ring('Cup handle',-9.58,.96,10.13,.07,.012,gold,'z')
 # Archive door: closed as a physical wall panel, gilded seal gives future curiosity.
 box('Sealed archive portal',-12.45,1.5,10,.35,3.0,2.45,dark)
 for zz in [8.63,11.37]:box('Archive jamb',-12.22,1.60,zz,.50,3.2,.25,edge)
 arch(-12.22,3.18,10,1.26,.25,.5,edge,'x',17)
 transom(-12.23,3.18,10,1.26,dark)
 for t in [i*math.pi/6 for i in range(1,6)]:tube('Archive transom spokes',[(-12.20,3.18,10),(-12.20,3.18+1.19*math.sin(t),10+1.19*math.cos(t))],.020,gold)
 for zz in [9.15,9.58,10,10.42,10.85]:box('Archive cedar boards',-12.21,1.48,zz,.10,2.89,.38,wood,.015)
 ring('Closed archive seal',-12.07,1.89,10,.62,.047,gold,'x');ring('Closed seal inner',-12.05,1.89,10,.43,.014,p['Benchmark lagoon'],'x')
 for t in [i*math.tau/8 for i in range(8)]:tube('Archive radial seal',[(-12.025,1.89+.44*math.sin(t),10+.44*math.cos(t)),(-12.025,1.89+.60*math.sin(t),10+.60*math.cos(t))],.018,gold)
 # Wayfinding lamps and noticeboard have no generated text.
 for x,z in [(-4.0,4.3),(4.0,4.3),(-9.8,8.45)]:
  column('Lamp carved base',x,.2,z,.22,.40,edge);column('Lamp post',x,1.06,z,.06,1.55,gold,12)
  box('Warm lantern pane',x,1.88,z,.29,.37,.29,paper,.03)
  for xx in [-.18,.18]:box('Lantern corner',x+xx,1.87,z,.03,.46,.35,gold,.005)
  box('Lantern cap',x,2.13,z,.45,.10,.45,slate)
 batch_export('courtyard')
 COURTYARD_DETAIL=False
def guardian():
 a.reset();p=palette();gold=p['Benchmark brass'];blue=p['Benchmark slate'];paper=p['Benchmark parchment'];dark=p['Benchmark ink'];edge=p['Benchmark carved edge'];teal=p['Benchmark lagoon']
 roots={n:group(n) for n in ['AtlasBody','Core','Ring','ArmLeft','ArmRight','Head']}
 def collect(parent,fn):
  before=set(bpy.data.objects);fn()
  for o in set(bpy.data.objects)-before:o.parent=roots[parent]
 def body():
  # Heavy broad boots and articulated supports.
  for x in [-.40,.40]:
   box('Atlas splayed foot',x,.16,.05,.64,.28,.83,blue,.10);box('Foot gilded edge',x,.22,.34,.61,.08,.08,gold)
   column('Telescopic shin',x,.64,0,.16,.87,gold,12);box('Shin enamel shield',x,.68,.17,.31,.61,.13,blue,.065)
  box('Atlas hip block',0,1.12,0,.94,.32,.57,gold,.09)
  box('Atlas spine housing',0,1.70,-.18,.53,1.17,.45,blue,.08)
  # Open atlas cuirass, two angled parchment folios like a protective breastplate.
  for sign in [-1,1]:
   x=sign*.36
   for layer in range(4):
    o=box('Layered atlas folio',x,1.81,.13+layer*.029,.69,1.07,.045,paper,.02);o.rotation_euler[2]=sign*.22
   o=box('Blue atlas cover',x,1.81,.02,.78,1.16,.065,blue,.025);o.rotation_euler[2]=sign*.22
   for yy in [1.41,2.21]:tube('Atlas page gold border',[(sign*.06,yy,.31),(sign*.66,yy,.15)],.016,gold)
   for yy in [1.61,1.76,1.91,2.06]:tube('Engraved map lines',[(sign*.16,yy,.30),(sign*.34,yy+.06,.265),(sign*.59,yy+.01,.20)],.008,gold)
  column('Atlas spinal brass crown',0,2.39,-.08,.17,.35,gold,12)
 collect('AtlasBody',body)
 def core():
  ring('Core socket',0,1.87,.43,.26,.049,gold,'z');ball('Core lantern lens',0,1.87,.45,.19,.21,.07,teal)
  for t in [0,math.pi/2,math.pi,3*math.pi/2]:tube('Core iris brace',[(math.cos(t)*.1,1.87+math.sin(t)*.1,.54),(math.cos(t)*.23,1.87+math.sin(t)*.23,.49)],.015,gold)
 collect('Core',core)
 def head():
  box('Atlas face mask',0,2.61,.04,.65,.48,.43,edge,.14);a.dome('Atlas helmet',at(0,2.75,.02),.42,.31,blue)
  for x in [-.15,.15]:
   o=box('Sleepy atlas eye',x,2.61,.277,.16,.043,.022,teal,.012);o.rotation_euler[1]=-.12 if x<0 else .12
  tube('Atlas nose ridge',[(0,2.76,.29),(0,2.58,.33),(0,2.54,.29)],.015,gold)
  tube('Atlas brow line',[(-.29,2.73,.20),(0,2.79,.29),(.29,2.73,.20)],.027,gold)
 collect('Head',head)
 for sign,name in [(-1,'ArmLeft'),(1,'ArmRight')]:
  def arm(s=sign):
   ball('Shoulder hinge',s*.79,2.10,0,.20,.20,.20,gold)
   box('Long articulated forearm',s*.98,1.64,.03,.23,.72,.25,gold,.07)
   box('Enamel bracer',s*1.02,1.60,.15,.29,.49,.16,blue,.05)
   ball('Atlas mitten',s*1.02,1.17,.06,.22,.19,.20,gold)
   # Folded paper vanes echo the signature's book geometry.
   for i in range(3):
    xx=s*(.65+i*.16);mesh('Shoulder map vane',[(xx,2.08,-.13),(xx+s*.12,2.18,-.09),(xx+s*.25,2.56+i*.035,-.12),(xx+s*.05,2.45,-.16)],[(0,1,2,3)],paper)
  collect(name,arm)
 def halo():
  ring('Atlas great meridian',0,2.01,-.31,1.13,.031,gold,'z')
  for i in range(12):
   t=i*math.tau/12;box('Meridian gold scale',math.cos(t)*1.13,2.01+math.sin(t)*1.13,-.31,.075,.075,.042,edge,.01)
 collect('Ring',halo)
 # Animated pivots, with geometry kept at current authored rest position.
 for name,origin in [('Head',(0,2.35,0)),('Core',(0,1.87,.43)),('Ring',(0,2.01,-.31)),('ArmLeft',(-.79,2.10,0)),('ArmRight',(.79,2.10,0))]:
  root=roots[name];delta=Vector(at(*origin));root.location=delta
  for child in root.children:child.location-=delta
 batch_export('guardian')
def accessories():
 a.reset();p=palette();gold=p['Benchmark brass'];blue=p['Benchmark slate'];paper=p['Benchmark parchment'];coral=p['Benchmark coral'];wood=p['Benchmark wood']
 # All meshes authored in wizard's REST world coordinates, Y-up after export.
 # Attach each group to named bone preserving world transform before first mixer update.
 def accessory(name,bone,fn):
  root=group(name);root['attachBone']=bone;root['restWorldCoordinates']=True
  before=set(bpy.data.objects);fn()
  for o in set(bpy.data.objects)-before:o.parent=root
 def partner_head():
  # Foldwright angular cap, broad horizontal folded-paper silhouette, no pointed crown.
  mesh('Foldwright folded cap',[(-.27,1.77,.09),(.27,1.77,.09),(.28,1.85,-.12),(0,1.98,-.10),(-.28,1.85,-.12),(0,1.76,.21)],[(0,1,5),(0,4,3,5),(1,5,3,2),(4,2,3),(0,1,2,4)],coral)
  tube('Cap folded gold edge',[(-.27,1.77,.10),(0,1.98,-.09),(.27,1.77,.10)],.012,gold)
  ball('Cap seal',.12,1.85,.105,.027,.032,.016,paper)
 accessory('PartnerHead','Head',partner_head)
 def mantle():
  # Two separated tails preserve legs while giving the partner a long silhouette.
  for sign in [-1,1]:
   mesh('Foldwright split mantle',[(sign*.04,1.39,-.115),(sign*.26,1.39,-.02),(sign*.25,.79,-.19),(sign*.07,.64,-.23)],[(0,1,2,3)],coral)
   tube('Mantle bound edge',[(sign*.04,1.39,-.125),(sign*.07,.65,-.235),(sign*.25,.80,-.195)],.009,gold)
 accessory('PartnerMantle','spine_03',mantle)
 def iona_head():
  # Visible hair and spectacles replace the shared wizard hat silhouette.
  for x in [-.048,.048]:ring('Iona brass spectacles',x,1.65,.117,.036,.006,gold,'z')
  tube('Spectacle bridge',[(-.012,1.65,.12),(.012,1.65,.12)],.005,gold)
  tube('Keeper crescent hair comb',[(-.08,1.765,-.01),(0,1.79,-.025),(.08,1.765,-.01)],.015,gold)
 accessory('IonaHead','Head',iona_head)
 def apron():
  mesh('Keeper long work apron',[(-.15,1.32,.16),(.15,1.32,.16),(.21,.69,.185),(-.21,.69,.185)],[(0,1,2,3)],paper)
  box('Keeper apron pocket',0,.91,.197,.26,.18,.025,coral,.008)
  for x in [-.08,0,.08]:tube('Keeper pocket instruments',[(x,.96,.222),(x,1.12,.223)],.007,gold)
  for yy in [.73,1.26]:tube('Apron broad seam',[(-.17,yy,.20),(.17,yy,.20)],.011,gold)
  for x in [.21,.26,.31]:ring('Keeper brass keys',x,.98,.04,.024,.009,gold,'z');tube('Key stem',[(x,.96,.04),(x,.87,.04),(x+.016,.87,.04)],.007,gold)
 accessory('IonaApron','spine_03',apron)
 batch_export('mage-accessories')
if __name__=='__main__':
 # A scoped rebuild avoids touching unrelated binary assets during art iteration.
 requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 for name,build in [('courtyard',courtyard),('guardian',guardian),('mage-accessories',accessories)]:
  if not requested or name in requested:build()
