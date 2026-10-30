// Map an unwarped, mirrored camera point through the live renderer's green channel.
// Only the debug box uses this inverse. Detection and run timing remain unchanged.
export function ripplePoint(p,{aspect=1,ripples=[]}={}){
 const ex=2*p.x-1,ey=2*p.y-1,fade=Math.max(0,(1-ex*ex)*(1-ey*ey));let x=p.x,y=p.y;
 for(const [age,amplitude,originX,originY] of ripples){
  const dx=(p.x-originX)*aspect,dy=p.y-originY,radius=Math.hypot(dx,dy),front=radius-age*.48;
  const offset=amplitude*Math.sin(front*39.269908)*Math.exp(-front*front/.0288)*Math.exp(-age*1.15);
  const t=Math.min(1,radius/.06),amount=offset*fade*t*t*(3-2*t)/Math.max(radius,.0001);
  x+=dx*amount/aspect;y+=dy*amount;
 }
 return {x,y};
}
export function sampleLivePoint(p,view={},channel=0,voiced=ripplePoint(p,view)){
 const {cover=[1,1],power=0,time=0}=view,split=1+channel*.45;
 let x=1-((p.x+(voiced.x-p.x)*split-.5)*cover[0]+.5),y=(p.y+(voiced.y-p.y)*split-.5)*cover[1]+.5;
 const dx=x-(.5+.08*Math.sin(time*.31)),dy=y-(.48+.07*Math.cos(time*.27));
 const ex=2*p.x-1,ey=2*p.y-1,t=Math.min(1,Math.max(0,(1-ex*ex)*(1-ey*ey))/.65),a=power*t*t*(3-2*t);
 const wave=Math.sin(Math.hypot(dx,dy)*13-time*1.9+channel*.8)*a*.65;x+=dx*wave;y+=dy*wave;
 x+=Math.sin(y*9+time*.8+channel*.26)*a*.45+Math.sin(y*24-time*1.3+channel)*a*.12;y+=Math.sin(x*11-time*.6+channel*.33)*a*.4;
 return {x,y};
}
export function projectLivePoint(point,view={}){
 if(view.flipY){const projected=projectLivePoint({x:point.x,y:1-point.y},{...view,flipY:false});return {x:projected.x,y:1-projected.y}}
 const cover=view.cover||[1,1],target={x:1-((point.x-.5)*cover[0]+.5),y:(point.y-.5)*cover[1]+.5};
 let p={...point};for(let i=0;i<16;i++){const q=sampleLivePoint(p,view);p={x:p.x+(q.x-target.x)/cover[0],y:p.y-(q.y-target.y)/cover[1]}}
 return p;
}
