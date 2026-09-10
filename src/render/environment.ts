import * as T from 'three';
import type { World } from './world';
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
export function buildEnvironment(w:World){
  const grass=w.material('#8ca978','leaf'), path=w.material('#d8c59e','stone'), roof=w.material('#426875','stone'), wood=w.material('#795d43','stone'), dark=w.material('#254958'), pink=w.material('#df8e89');
  w.box(180,.6,180,grass,0,-.4,-15);w.box(26,.12,39,path,0,-.05,-3.5);
  // Broad, irregular paving with quiet variation, instanced to keep draw calls bounded.
  const tiles=new T.InstancedMesh(new T.BoxGeometry(1.22,.035,1.23),path,600);const mat=new T.Matrix4();let count=0;
  for(let z=-21;z<16;z+=1.3)for(let x=-12.4;x<13;x+=1.3){mat.compose(new T.Vector3(x+(Math.round(z*10)%2)*.15,.036,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(rand(count)-.5)*.065),new T.Vector3(.92+rand(count+2)*.08,1,.96));tiles.setMatrixAt(count,mat);tiles.setColorAt(count,new T.Color().setHSL(.11,.24,.61+rand(count)*.17));count++}tiles.count=count;tiles.receiveShadow=true;w.environment.add(tiles);
  for(const x of [-14,14]){w.box(.65,1.4,43,w.stone,x,.7,-4);w.box(.85,.18,43,w.gold,x,1.43,-4);for(let z=-24;z<18;z+=5){w.box(1,1.8,1,w.stone,x,.9,z);w.sphere(.28,w.gold,x,1.98,z)}}
  // Hero facades and social anchor arrive from the authored courtyard GLB.
  // Garden borders leave a clear central route and little pockets to explore.
  for(const x of [-6.6,6.6])for(const z of [9,2,-6,-13]){w.box(2.5,.27,3.8,w.stone,x,.15,z);w.box(2.25,.1,3.55,grass,x,.33,z);for(let i=0;i<16;i++){const px=x+(rand(i+z*4)-.5)*2,pz=z+(rand(i+100+z*4)-.5)*3;const stem=w.mesh(new T.CylinderGeometry(.025,.035,.4,5),w.green,px,.55,pz);stem.castShadow=false;for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5;const fl=w.mesh(new T.SphereGeometry(.074,6,3),pink,px+Math.cos(a)*.09,.73+Math.sin(a)*.035,pz+Math.sin(a)*.09);fl.scale.set(1.4,.7,.9);fl.castShadow=false}const center=w.mesh(new T.SphereGeometry(.043,5,3),w.gold,px,.78,pz);center.castShadow=false;const leaf=w.mesh(new T.SphereGeometry(.1,6,3),w.green,px+.05,.46,pz);leaf.scale.set(2,.35,.7);leaf.castShadow=false}}
  for(const x of [-7.3,7.3])for(const z of [13,-1,-10,-19])tree(w,x,z,3.7+rand(z)*1.5,wood,grass);
  for(let i=0;i<36;i++){const side=i%2?1:-1;tree(w,side*(19+rand(i)*20),-45+rand(i+90)*76,4+rand(i+25)*7,wood,grass)}
  for(let i=0;i<12;i++){const m=w.sphere(15+rand(i)*13,w.material(i%2?'#759996':'#98b2a1'),-75+i*13,-4,-65-rand(i+25)*20);m.scale.set(1,1.2,1)}
  // Human touches: benches, cups, books, pots and pennants.
  for(const x of [-4.8,4.8]){w.box(1.7,.13,.6,wood,x,.55,11);w.box(1.7,.65,.12,wood,x,.95,11.3);for(const dx of [-.65,.65])w.box(.12,.6,.5,dark,x+dx,.28,11);w.box(.4,.08,.27,pink,x+.2,.66,11);w.box(.32,.08,.3,roof,x+.1,.75,11)}
  for(const [x,z] of [[4,1],[-5,-9]]){w.mesh(new T.CylinderGeometry(.42,.58,.65,10),wood,x,.33,z);w.ring(.4,.035,w.gold,x,.69,z)}
  w.sphere(.23,w.lamp,4,1.25,1);w.ring(.38,.028,w.gold,4,1.25,1).rotation.x=.2;w.box(.68,.1,.46,roof,-5,.85,-9).rotation.z=.15;
  for(const x of [-4.5,4.5])for(const z of [6,-4,-15]){w.mesh(new T.CylinderGeometry(.05,.09,2.4,8),dark,x,1.2,z);w.box(.35,.5,.35,w.lamp,x,2.5,z);w.mesh(new T.ConeGeometry(.32,.3,4),roof,x,2.9,z);}
  const arch=new T.Shape();arch.absarc(0,0,2.5,0,Math.PI,false);arch.absarc(0,0,2.18,Math.PI,0,true);const a=w.mesh(new T.ExtrudeGeometry(arch,{depth:.5,bevelEnabled:false}),w.stone,0,3.0,18.8);a.castShadow=true;for(const x of [-2.35,2.35])w.box(.35,3,.55,w.stone,x,1.5,19);w.ring(3.6,.045,w.gold,0,.11,-14);
  w.makeEnemies();
  w.awakened.position.set(0,9.3,-23);w.scene.add(w.awakened);for(let i=0;i<3;i++){const ring=w.ring(2.0+i*.2,.035,w.gold,0,0,0,w.awakened);ring.rotation.set(i*.8,.3,i*.7)}w.sphere(.5,w.lamp,0,0,0,w.awakened);for(let i=0;i<14;i++)w.sphere(.06,w.lamp,Math.cos(i)*2.7,Math.sin(i*2)*1.5,Math.sin(i)*2.7,w.awakened);w.awakened.visible=false;
  w.doorwayLight.position.set(0,0,-18.9);w.scene.add(w.doorwayLight);const aura=new T.MeshBasicMaterial({color:'#ffdb82',transparent:true,opacity:.16,depthWrite:false});const glow=w.sphere(1.35,aura,0,1.9,0,w.doorwayLight);glow.scale.set(1,1.45,.2);const hoop=w.ring(1.4,.035,w.lamp,0,1.9,.1,w.doorwayLight);hoop.rotation.x=Math.PI/2;hoop.scale.y=1.3;for(let i=0;i<16;i++)w.sphere(.07,w.lamp,Math.cos(i)*1.7,1.8+Math.sin(i)*1.6,.3+Math.sin(i*3)*.4,w.doorwayLight);w.doorwayLight.add(new T.PointLight('#ffd899',18,14,2));w.doorwayLight.visible=false;
 
}
function tree(w:World,x:number,z:number,h:number,wood:T.Material,leaf:T.Material){
 const group=new T.Group();group.position.set(x,0,z);w.environment.add(group);
 w.mesh(new T.CylinderGeometry(.10,.22,h*.7,7),wood,0,h*.35,0,group);
 const cypress=Math.abs(x)<9;
 for(let i=0;i<(cypress?3:4);i++){
  const m=w.mesh(new T.SphereGeometry(1,12,10),w.material(cypress?'#537e61':'#658673','leaf'),(rand(i+x)-.5)*h*.1,h*(cypress?.43+i*.15:.5+i*.09),(rand(i+z)-.5)*h*.1,group);
  m.scale.set(h*(cypress?.17-i*.035:.26),h*(cypress?.27:.22),h*(cypress?.15-i*.029:.22));m.rotation.z=(rand(i+x)-.5)*.14;
 }
}
