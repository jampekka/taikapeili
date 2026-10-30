// A few canvas draws only: no segmentation, pixel readbacks, or inference.
export function transformSnapshot({image,face,intensity=1}){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 // Lift the captured image with one screen draw; black surroundings stay black.
 ctx.globalCompositeOperation='screen';ctx.globalAlpha=.8;ctx.drawImage(image,0,0);ctx.globalAlpha=1;
 ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgb(225,245,225)';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.globalCompositeOperation='source-over';
 const eyes=face.eyes||[],distance=eyes.length===2?Math.hypot((eyes[1].x-eyes[0].x)*canvas.width,(eyes[1].y-eyes[0].y)*canvas.height):canvas.width*.2;
 for(const eye of eyes){
  const x=eye.x*canvas.width,y=eye.y*canvas.height;
  ctx.save();ctx.translate(x,y);ctx.scale(distance*.2,distance*.12);
  const shadow=ctx.createRadialGradient(0,0,.05,0,0,1);shadow.addColorStop(0,'rgba(13,8,20,.9)');shadow.addColorStop(1,'rgba(13,8,20,0)');ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();
  ctx.fillStyle=`rgba(250,255,240,${intensity})`;ctx.beginPath();ctx.ellipse(x,y,distance*.055,distance*.035,0,0,Math.PI*2);ctx.fill();
 }
 return canvas;
}
