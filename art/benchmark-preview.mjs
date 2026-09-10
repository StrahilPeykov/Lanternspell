
import * as T from 'three';import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';import {clone} from '/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
const scene=new T.Scene();scene.background=new T.Color('#abc3be');const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);scene.add(new T.HemisphereLight('#e5f3ff','#726347',2));const sun=new T.DirectionalLight('#fff0ce',2.8);sun.position.set(-8,13,9);scene.add(sun);const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,150);const mode=new URLSearchParams(location.search).get('mode')||'courtyard';const loader=new GLTFLoader(),mixers=[];
const ground=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({color:'#9ca57f'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
if(mode==='mages'){
 const [base,extras]=await Promise.all([loader.loadAsync('/assets/wizard.glb'),loader.loadAsync('/assets/mage-accessories.glb')]);
 for(let i=0;i<3;i++){
  const mage=clone(base.scene);scene.add(mage);mage.updateMatrixWorld(true);
  const hidden=['Bent tailored crown','Traveler brim','Hat band','Hat enamel pin'];if(i===2)hidden.push('Rowan staff','Staff lantern','Staff open circle','Short scholar capelet');
  if(i)for(const n of hidden){const part=mage.getObjectByName(n.replaceAll(' ','_'));if(part)part.visible=false;}
  if(i){for(const source of extras.scene.children.filter(o=>o.name.startsWith(i===1?'Partner':'Iona'))){const piece=source.clone();scene.add(piece);piece.updateMatrixWorld(true);const bone=mage.getObjectByName(source.userData.attachBone);bone.attach(piece)}}
  const mixer=new T.AnimationMixer(mage);mixer.clipAction(base.animations.find(a=>a.name===(new URLSearchParams(location.search).get('clip')||'Idle'))).play();mixers.push(mixer);mage.position.x=(i-1)*1.7;
 }
 camera.position.set(3.7,2.25,7.2);camera.lookAt(0,1.05,0);
}else{
 const g=await loader.loadAsync('/assets/'+(mode==='guardian'?'guardian':mode==='moth'?'paper-moth':'courtyard')+'.glb');scene.add(g.scene);
 if(mode==='moth'){camera.position.set(2.1,1.9,3.8);camera.lookAt(0,1.4,0);window.moth=g.scene;}else if(mode==='guardian'){camera.position.set(4.7,3.1,7.5);camera.lookAt(0,1.5,0);window.atlas=g.scene;}
 else {const obs=await loader.loadAsync('/assets/observatory.glb');obs.scene.position.set(0,0,-22);scene.add(obs.scene);camera.position.set(mode==='pocket'?-7:1,mode==='pocket'?3:3.6,mode==='pocket'?14.5:15);camera.lookAt(mode==='pocket'?-11:0,mode==='pocket'?1.7:2,mode==='pocket'?10:-8)}
}
window.artReady=true;let last=performance.now(),phase=0;renderer.setAnimationLoop(t=>{const dt=Math.min(.05,(t-last)/1000);last=t;phase+=dt;for(const m of mixers)m.update(dt);if(window.moth){window.moth.getObjectByName('WingLeft').rotation.y=Math.sin(phase*4)*.5;window.moth.getObjectByName('WingRight').rotation.y=-Math.sin(phase*4)*.5;}if(window.atlas){window.atlas.getObjectByName('Ring').rotation.z=Math.sin(phase*.5)*.13;window.atlas.getObjectByName('ArmLeft').rotation.z=Math.sin(phase)*.08}renderer.render(scene,camera)});




