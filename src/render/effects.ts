import * as T from 'three';
export type SignatureTreatment='pages'|'spirit'|'eclipse';
/** Short-lived effect owns every geometry/material it creates. No gameplay callbacks. */
export class SpellEffects {
 readonly group=new T.Group(); treatment:SignatureTreatment='spirit'; low=false;
 private elapsed=0;private duration=0;private signature=false;private start=new T.Vector3();private end=new T.Vector3();private creature?:T.Group;
 private part(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,parent:T.Object3D=this.group){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m}
 private ring(r:number,mat:T.Material,y=0){const m=this.part(new T.TorusGeometry(r,.024,5,48),mat,0,y);m.rotation.x=-Math.PI/2;return m}
 begin(spell:string,origin:T.Vector3,target:T.Vector3,duration:number,hearth=false){
  this.clear();this.start.copy(origin);this.end.copy(target);this.duration=duration;this.signature=spell==='unfold';this.group.position.copy(target);
  const ink=new T.MeshBasicMaterial({color:hearth?'#ffe0a2':'#b6f5f1',side:T.DoubleSide});
  const gold=new T.MeshBasicMaterial({color:'#eabb68'});const paper=new T.MeshStandardMaterial({color:hearth?'#f8c786':'#fff0cc',emissive:hearth?'#8b4817':'#254d58',emissiveIntensity:.35,roughness:.7,side:T.DoubleSide});
  if(this.signature&&this.treatment==='pages'){
   for(let i=0;i<(this.low?6:10);i++){const a=i/(this.low?6:10)*Math.PI*2;const page=this.part(new T.PlaneGeometry(.66,.95,1,1),paper,Math.cos(a)*1.8,1.5+Math.sin(a*2)*.4,Math.sin(a)*1.8);page.rotation.set(.3,-a+.6,.15);const seam=this.part(new T.BoxGeometry(.025,.78,.018),gold,0,0,.01,page);seam.rotation.z=.08;}
   for(let i=0;i<3;i++){const r=this.ring(1.35+i*.3,ink,1+i*.45);r.rotation.z=i*.6}
  }else if(this.signature&&this.treatment==='spirit'){
   const bird=this.creature=new T.Group();this.group.add(bird);bird.position.y=1.4;
   const body=this.part(new T.OctahedronGeometry(.58,1),paper,0,0,0,bird);body.scale.set(.7,.85,1.8);
   const head=this.part(new T.SphereGeometry(.25,12,8),paper,0,.5,.64,bird);
   const beak=this.part(new T.ConeGeometry(.085,.48,6),gold,0,.47,.97,bird);beak.rotation.x=Math.PI/2;
   for(const x of [-.145,.145])this.part(new T.SphereGeometry(.045,8,6),ink,x,.54,.81,bird);
   for(const side of [-1,1]){const wing=new T.Group();wing.name='wing';wing.userData.side=side;wing.position.set(side*.2,.1,0);bird.add(wing);
    for(let j=0;j<5;j++){const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*(1.7-j*.15),.42-j*.1);shape.lineTo(side*(1.1-j*.11),-.12-j*.1);shape.lineTo(0,-.16);const feather=this.part(new T.ShapeGeometry(shape),j%2?ink:paper,0,-j*.035,-j*.18,wing);feather.rotation.x=-.4;}
   }
   const tail=this.part(new T.ConeGeometry(.26,1,4),gold,0,-.12,-.88,bird);tail.rotation.x=-Math.PI/2;
   this.ring(1.7,gold,.12);this.ring(1.9,ink,.14);
  }else if(this.signature){
   const halo=this.ring(1.65,gold,2.0);halo.rotation.x=.25;this.part(new T.SphereGeometry(.4,20,12),ink,0,2.0,0);
   for(let i=0;i<(this.low?6:12);i++){const a=i*Math.PI/6;const ray=this.part(new T.ConeGeometry(.085,1.1,5),gold,Math.cos(a)*1.2,2.0+Math.sin(a)*1.2,0);ray.rotation.z=a-Math.PI/2}
   for(let i=0;i<3;i++)this.ring(1.1+i*.45,ink,.15+i*.12);
  }else if(spell==='shelter'||spell==='mend'){
   for(let i=0;i<3;i++){const hoop=this.ring(.75+i*.15,ink,.35+i*.5);hoop.rotation.z=i*.22}
   for(let i=0;i<6;i++)this.part(new T.OctahedronGeometry(.09),gold,Math.cos(i)*.9,.6+Math.sin(i*2)*.3,Math.sin(i)*.9);
  }else if(spell==='mark'&&hearth){for(let i=0;i<3;i++){const thread=this.ring(.65+i*.15,gold,.4+i*.32);thread.rotation.z=(i%2?1:-1)*.7}this.part(new T.OctahedronGeometry(.18),ink,0,1.3,0);
  }else if(spell==='mark'){for(let i=0;i<4;i++){const page=this.part(new T.PlaneGeometry(.24,.58),paper,Math.cos(i*Math.PI/2)*.55,1.0,Math.sin(i*Math.PI/2)*.55);page.rotation.y=i*Math.PI/2;page.rotation.z=.22}this.ring(.65,ink,.12);
  }else{
   const count=this.low?6:10;for(let i=0;i<count;i++)this.part(new T.OctahedronGeometry(.08+(i%3)*.04),i%2?ink:gold,Math.cos(i)*.6,1+Math.sin(i*1.8)*.6,Math.sin(i)*.6);
   this.ring(.75,ink,.12);
  }
  // Discard unused shared choices immediately, retain exactly those attached to this effect.
  const used=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh)used.add(o.material as T.Material)});for(const m of [ink,gold,paper])if(!used.has(m))m.dispose();
 }
 update(dt:number){if(!this.duration)return;this.elapsed+=dt;const t=Math.min(1,this.elapsed/this.duration),rise=Math.min(1,t/.2),fade=Math.min(1,(1-t)/.15);
  this.group.scale.setScalar(Math.max(.01,rise*fade));
  if(this.signature&&this.treatment==='spirit'&&this.creature){this.group.position.lerpVectors(this.start,this.end,Math.min(1,t/.65));this.creature.position.y=.9+Math.sin(t*Math.PI)*.65;this.creature.rotation.y=Math.atan2(this.end.x-this.start.x,this.end.z-this.start.z);this.creature.rotation.x=Math.sin(t*Math.PI*2)*.15;this.creature.children.forEach(o=>{if(o.name==='wing')o.rotation.z=Math.sin(t*Math.PI*4)*.42*o.userData.side})}
  else this.group.rotation.y+=dt*(this.signature?.35:1.4);
  if(t===1)this.clear();
 }
 clear(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.clear();this.group.rotation.set(0,0,0);this.group.scale.setScalar(1);this.creature=undefined;this.elapsed=this.duration=0}
}
