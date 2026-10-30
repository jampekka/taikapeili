function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Person detector asset failed to load'));document.head.append(s)})}
export function summarizeMask(mask){
 const {width,height,data}=mask;let count=0,left=width,right=0,top=height,bottom=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[y*width+x]){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
 const coverage=count/(width*height);
 return {present:coverage>.035,coverage,bounds:count?{x:left/width,y:top/height,width:(right-left+1)/width,height:(bottom-top+1)/height}:null,mask};
}
export class PersonPresence {
 constructor(){this.input=document.createElement('canvas');this.ctx=this.input.getContext('2d',{willReadFrequently:true});this.last=null;this.previous=null;this.lastInference=-Infinity;this.inferenceMs=0;this.cacheHits=0;this.status='loading'}
 async load(tf){
  // Reuse the existing TF backend. These classic UMD bundles share the same engine.
  globalThis.tf=Object.assign({},tf);await script('./vendor/tf-converter.min.js');await script('./vendor/body-pix.min.js');
  this.net=await globalThis.bodyPix.load({architecture:'MobileNetV1',outputStride:16,multiplier:.5,quantBytes:1,modelUrl:'./models/bodypix/model.json'});this.status='ready · tiny BodyPix';return this;
 }
 async detect(image,{force=false}={}){
  const width=image.videoWidth||image.naturalWidth||image.width,height=image.videoHeight||image.naturalHeight||image.height;
  const scale=160/Math.max(width,height),w=Math.max(32,Math.round(width*scale)),h=Math.max(32,Math.round(height*scale));
  if(this.input.width!==w||this.input.height!==h){this.input.width=w;this.input.height=h;this.previous=null;this.last=null}
  this.ctx.drawImage(image,0,0,w,h);const bytes=this.ctx.getImageData(0,0,w,h).data;let change=1;
  if(this.previous){let sum=0,n=0;for(let i=0;i<bytes.length;i+=32){sum+=Math.abs(bytes[i]-this.previous[i])+Math.abs(bytes[i+1]-this.previous[i+1])+Math.abs(bytes[i+2]-this.previous[i+2]);n+=3}change=sum/(n*255)}
  const now=performance.now();
  if(!force&&this.last&&change<.018&&now-this.lastInference<1500){this.cacheHits++;return {...this.last,reused:true,change}}
  this.previous=new Uint8ClampedArray(bytes);const start=performance.now();
  const mask=await this.net.segmentPerson(this.input,{internalResolution:'medium',segmentationThreshold:.55,maxDetections:1,scoreThreshold:.3});
  this.inferenceMs=performance.now()-start;this.lastInference=performance.now();this.last=summarizeMask(mask);return {...this.last,reused:false,change};
 }
}
export function applyPersonMask(image,mask){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
 if(!mask)return canvas;
 const small=document.createElement('canvas');small.width=mask.width;small.height=mask.height;const m=small.getContext('2d'),pixels=m.createImageData(mask.width,mask.height);
 for(let i=0;i<mask.data.length;i++){pixels.data[i*4]=255;pixels.data[i*4+1]=255;pixels.data[i*4+2]=255;pixels.data[i*4+3]=mask.data[i]?255:0}m.putImageData(pixels,0,0);
 const feather=document.createElement('canvas');feather.width=canvas.width;feather.height=canvas.height;const f=feather.getContext('2d');f.filter='blur(2px)';f.drawImage(small,0,0,canvas.width,canvas.height);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(feather,0,0);ctx.globalCompositeOperation='source-over';return canvas;
}
export function faceFromPerson(person){const b=person.bounds;return {eyes:[{x:b.x+b.width*.38,y:b.y+b.height*.19},{x:b.x+b.width*.62,y:b.y+b.height*.19}],center:{x:b.x+b.width*.5,y:b.y+b.height*.5},width:b.width,height:b.height,score:person.coverage,person:true}}

// A failed/empty body mask must never veto a real face detection.
export function combinePresence(person,faces=[]){
 if(faces.length)return faces;
 return person?.present?[faceFromPerson(person)]:[];
}
