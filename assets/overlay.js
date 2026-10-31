// Map an unwarped, mirrored camera point through the live renderer's green channel.
// Debug boxes and the ghost eye anchor use this inverse; capture stays unwarped.
export function ripplePoint(p,{aspect=1,ripples=[],sources=[],speechPower=0,rippleReach=1}={}){
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
 const shortSide=Math.min(aspect,1),edgeDistance=Math.min(Math.min(p.x,1-p.x)*aspect,Math.min(p.y,1-p.y))/shortSide,fade=smooth(0,.015,edgeDistance)*(1-smooth(.17*rippleReach,.44*rippleReach,edgeDistance));
 // The local swell retains the pre-perimeter profile; travelling waves have their own reach.
 const nearestEdge=Math.min(p.x,1-p.x,p.y,1-p.y),sourceFade=smooth(0,.015,p.x)*smooth(0,.015,1-p.x)*smooth(0,.015,p.y)*smooth(0,.015,1-p.y)*(1-smooth(.12,.36,nearestEdge));
 let x=p.x,y=p.y;
 if(speechPower>.00001)for(const [originX,originY] of sources){
  const dx=(p.x-originX)*aspect,dy=p.y-originY,radius=Math.hypot(dx,dy);
  const amount=-speechPower*Math.exp(-Math.pow(radius/(aspect*.16),2))*sourceFade;
  x+=dx*amount/aspect;y+=dy*amount;
 }
 for(const [age,amplitude,originX,originY] of ripples){
  const dx=(p.x-originX)*aspect,dy=p.y-originY,radius=Math.hypot(dx,dy),front=radius-age*.48;
  const offset=amplitude*Math.sin(front*39.269908)*Math.exp(-front*front/.0288-radius/(shortSide*.25*rippleReach)-age*2.7);
  const t=Math.min(1,radius/.06),amount=offset*fade*t*t*(3-2*t)/Math.max(radius,.0001);
  x+=dx*amount/aspect;y+=dy*amount;
 }
 return {x,y};
}
export function sampleLivePoint(p,view={},channel=0,voiced=ripplePoint(p,view)){
 const {cover=[1,1],power=0,time=0,rgbSplit=1}=view;channel*=rgbSplit;const split=1+channel*.45;
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
 let p={...point};for(let i=0;i<48;i++){const q=sampleLivePoint(p,view),dx=(q.x-target.x)/cover[0],dy=(q.y-target.y)/cover[1];if(Math.abs(dx)+Math.abs(dy)<1e-7)break;p={x:p.x+dx,y:p.y-dy}}
 return p;
}

// Undo camera mirroring/crop only: retain the exact displayed warp for the lamps.
export function lampSamplePoint(q,{cover=[1,1]}={}){
 return {x:((1-q.x)-.5)/cover[0]+.5,y:(q.y-.5)/cover[1]+.5};
}
