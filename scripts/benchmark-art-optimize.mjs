import {NodeIO} from '@gltf-transform/core';
import {dedup,prune} from '@gltf-transform/functions';
import {rename} from 'node:fs/promises';
const io=new NodeIO();
for(const name of (process.argv.slice(2).length ? process.argv.slice(2) : ['courtyard','guardian','mage-accessories'])){
 const doc=await io.read(`public/assets/${name}.glb`);
 // Keep authored animation/attachment pivots (extras and children) while sharing data.
 await doc.transform(dedup(),prune({keepLeaves:true}));
 await io.write(`art/${name}-opt.glb`,doc);
 await rename(`art/${name}-opt.glb`,`public/assets/${name}.glb`);
 const root=doc.getRoot();let triangles=0,primitives=0;
 for(const m of root.listMeshes())for(const p of m.listPrimitives()){primitives++;triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;}
 console.log(JSON.stringify({name,triangles,primitives,materials:root.listMaterials().length,textures:root.listTextures().length,roots:root.listScenes()[0].listChildren().map(n=>n.getName())}));
}

