// Map an unwarped, mirrored camera point through the live renderer's green channel.
// Only the debug box uses this inverse. Detection and run timing remain unchanged.
export function sampleLivePoint(p,{cover=[1,1],power=0,time=0}={}){
 let x=1-((p.x-.5)*cover[0]+.5),y=(p.y-.5)*cover[1]+.5;
 const dx=x-(.5+.08*Math.sin(time*.31)),dy=y-(.48+.07*Math.cos(time*.27));
 const ex=2*p.x-1,ey=2*p.y-1,t=Math.min(1,Math.max(0,(1-ex*ex)*(1-ey*ey))/.65),a=power*t*t*(3-2*t);
 const wave=Math.sin(Math.hypot(dx,dy)*13-time*1.9)*a*.65;x+=dx*wave;y+=dy*wave;
 x+=Math.sin(y*9+time*.8)*a*.45+Math.sin(y*24-time*1.3)*a*.12;y+=Math.sin(x*11-time*.6)*a*.4;
 return {x,y};
}
export function projectLivePoint(point,view={}){
 const cover=view.cover||[1,1],target={x:1-((point.x-.5)*cover[0]+.5),y:(point.y-.5)*cover[1]+.5};
 let p={...point};for(let i=0;i<6;i++){const q=sampleLivePoint(p,view);p={x:p.x+(q.x-target.x)/cover[0],y:p.y-(q.y-target.y)/cover[1]}}
 return p;
}
