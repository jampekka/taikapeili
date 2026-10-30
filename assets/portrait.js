export function eyeGeometry(face,width,height){
 const fallback=[{x:face.center.x-face.width*.18,y:face.center.y-face.height*.08},{x:face.center.x+face.width*.18,y:face.center.y-face.height*.08}];
 const eyes=(face.eyes?.length===2?face.eyes:fallback).map(p=>({x:p.x*width,y:p.y*height})).sort((a,b)=>a.x-b.x);
 const mid={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2};
 return {eyes,mid,angle:Math.atan2(eyes[1].y-eyes[0].y,eyes[1].x-eyes[0].x)};
}
export function levelPortrait(image,face){
 const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
 const geometry=eyeGeometry(face,width,height),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');ctx.translate(geometry.mid.x,geometry.mid.y);ctx.rotate(-geometry.angle);ctx.translate(-geometry.mid.x,-geometry.mid.y);ctx.drawImage(image,0,0);
 return {image:canvas,focus:{x:geometry.mid.x/width,y:geometry.mid.y/height},eyeAngle:0};
}
export function revealZoom(elapsed,reduced=false){if(reduced)return 1.12;return elapsed<60?.02+1.28*(1-(1-elapsed/60)**3):1.3+.3*Math.min(1,(elapsed-60)/590)}
