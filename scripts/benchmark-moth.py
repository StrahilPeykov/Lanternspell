"""Original folded manuscript moth, independently reproducible without other exports."""
import bpy,math,pathlib,importlib.util
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('benchmarkart',pathlib.Path(__file__).with_name('benchmark-art.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.a.reset()
paper=b.a.mat('Moth warm paper',(.90,.79,.54),texture=True)
ink=b.a.mat('Moth indigo ink',(.055,.105,.135),texture=False)
gold=b.a.mat('Moth brass binding',(.67,.36,.11),.25,False)
def ribbon(name,points,width,mat,parent):
 for start,end in zip(points,points[1:]):
  d=Vector((end[0]-start[0],end[1]-start[1],0));d.normalize();side=Vector((-d.y,d.x,0))*width/2
  s=Vector(start);e=Vector(end)
  o=b.mesh(name,[tuple(s+side),tuple(e+side),tuple(e-side),tuple(s-side)],[(0,1,2,3)],mat);o.parent=parent
def wing(sign,name):
 root=b.group(name);root['restPivot']=[sign*.065,1.2,0];root['foldAxis']='y'
 # Four broad folded sheets meet along visible radial creases.
 # Absolute coordinates match the actor-space ground-origin convention.
 outline=[(.06,1.37,.02),(.32,1.90,.10),(.69,2.05,.015),(1.12,1.82,-.025),(1.05,1.66,-.015),(.91,1.70,.00),(1.01,1.46,.01),(.83,1.47,.03),(.83,1.18,.035),(.57,1.10,.06),(.40,.87,.075),(.17,1.03,.025),(.06,1.08,.02)]
 outline=[(x*sign,y,z) for x,y,z in outline]
 center=(sign*.31,1.40,.145);verts=outline+[center];ci=len(outline)
 o=b.mesh('Folded manuscript wing',verts,[(ci,i,(i+1)%ci) for i in range(ci)],paper);o.parent=root
 # Painted ink lines lie just above each folded face, not separate projected pictures.
 def point(x,y,z):return(sign*x,y,z+.008)
 ribbon('Manuscript margin',[point(.14,1.37,.062),point(.34,1.82,.088),point(.70,1.96,.035),point(1.01,1.80,.000)],.014,ink,root)
 ribbon('Lower manuscript margin',[point(.15,1.13,.068),point(.23,1.09,.077),point(.40,.98,.07),point(.58,1.17,.083),point(.76,1.25,.06)],.012,ink,root)
 for xx,yy,zz in [(.33,1.79,.115),(.65,1.88,.072),(.94,1.69,.024),(.76,1.38,.070),(.53,1.13,.095)]:
  ribbon('Branching ink vein',[point(.12,1.24,.063),point(.31,1.40,.145),point(xx,yy,zz)],.008,ink,root)
 # A few short hand-drawn runic dashes carry the manuscript motif without unreadable text.
 for j in range(5):
  x=.40+j*.085;y=1.68-j*.054;z=.12-j*.014
  ribbon('Original ink notation',[point(x,y,z),point(x+.045,y+.018,z-.005),point(x+.075,y-.016,z-.012)],.010,ink,root)
 # Root moves to hinge; geometry retains authored world position.
 delta=Vector(b.at(sign*.065,1.2,0));root.location=delta
 for child in root.children:child.location-=delta
 return root
wing(-1,'WingLeft');wing(1,'WingRight')
body=b.group('MothBody')
before=set(bpy.data.objects)
# Little book-spine abdomen, central folded cover and overlapping page leaves.
for i in range(3):
 z=.035+i*.025
 b.mesh('Book folded abdomen',[(-.095,1.10,z),(-.060,.91,z),(.060,.91,z),(.095,1.10,z),(0,1.36,z+.07)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],paper if i<2 else gold)
b.mesh('Moth folded head',[(-.10,1.37,.04),(0,1.54,.09),(.10,1.37,.04),(0,1.26,.16)],[(0,1,3),(1,2,3),(2,0,3)],paper)
for side in [-1,1]:
 b.mesh('Moth ink eye',[(side*.048-.015,1.396,.117),(side*.048+.015,1.396,.117),(side*.048+.015,1.431,.117),(side*.048-.015,1.431,.117)],[(0,1,2,3)],ink)
 ribbon('Folded antenna',[(side*.055,1.47,.08),(side*.12,1.66,.08),(side*.19,1.71,.04)],.015,gold,body)
for o in set(bpy.data.objects)-before:
 if not o.parent:o.parent=body
b.batch_export('paper-moth')
