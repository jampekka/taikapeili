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
export function revealZoom(elapsed,reduced=false){
 if(reduced)return 1.12;
 const t=Math.max(0,elapsed);
 if(t<50)return .02+1.78*(1-(1-t/50)**3);
 if(t<135)return 1.8-.3*(1-(1-(t-50)/85)**2);
 return 1.5+.15*Math.min(1,(t-135)/515);
}
export function revealImpact(elapsed,reduced=false){
 if(reduced)return {x:0,y:0,brightness:0};
 const t=Math.max(0,elapsed),fade=Math.max(0,1-t/650)**2,jolt=Math.floor(t/23);
 const pulse=(at,width)=>Math.exp(-(((t-at)/width)**2));
 return {x:.022*fade*Math.sin(jolt*2.4),y:.017*fade*Math.sin(jolt*4.1),brightness:.48*pulse(65,20)+.34*pulse(245,27)+.25*pulse(430,20)};
}
