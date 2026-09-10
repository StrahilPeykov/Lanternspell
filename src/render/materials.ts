import * as T from 'three';
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
/** One owned wash/material per surface; never dispose shared pool entries from temporary effects. */
export class SurfaceLibrary {
 private cache=new Map<string,T.MeshStandardMaterial>();
 material(color:string,kind='plain'){const key=color+':'+kind;const found=this.cache.get(key);if(found)return found;const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,128,128);for(let i=0;i<170;i++){ctx.fillStyle=i%2?'#ffffff0c':'#203c3510';ctx.beginPath();ctx.ellipse(rand(i)*128,rand(i+900)*128,4+rand(i+30)*17,1+rand(i+40)*4,rand(i+100)*2,0,Math.PI*2);ctx.fill()}if(kind==='stone'){ctx.strokeStyle='#716b4930';ctx.lineWidth=1;for(let y=0;y<128;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();for(let x=(y%64?24:0);x<128;x+=48){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke()}}}const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;const material=new T.MeshStandardMaterial({map,roughness:kind==='metal'?.55:.92,metalness:kind==='metal'?.32:0});this.cache.set(key,material);return material}
 get size(){return this.cache.size}
}
