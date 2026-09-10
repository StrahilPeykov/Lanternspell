import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
const io=new NodeIO();const doc=await io.read('art/wizard-pruned.glb');
const size=128, pixels=Buffer.alloc(size*size*3);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const value=Math.round(228+12*Math.sin(x*.12+y*.041)+9*Math.cos(y*.18));
  const offset=(y*size+x)*3;pixels[offset]=pixels[offset+1]=pixels[offset+2]=value;
}
const image=await sharp(pixels,{raw:{width:size,height:size,channels:3}}).png().toBuffer();
const wash=doc.createTexture('Neutral identity wash').setImage(image).setMimeType('image/png');
for(const m of doc.getRoot().listMaterials())if(m.getName()==='Identity')m.setBaseColorTexture(wash).setBaseColorFactor([.10,.48,.46,1]);
await io.write('art/wizard-final.glb',doc);
