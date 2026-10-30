// One smooth Gaussian lens, with the image edges held fixed.
export function centralScale(x,y,bulge=0){
 const dx=x-.5,dy=y-.5,edge=Math.max(0,(1-4*dx*dx)*(1-4*dy*dy));
 return 1-bulge*Math.exp(-12.5*(dx*dx+dy*dy))*edge;
}
// Map the displayed mirror back into the uncropped camera texture.
export function sampleLivePoint(p,{cover=[1,1],bulge=0}={}){
 const scale=centralScale(p.x,p.y,bulge);
 return {x:1-((p.x-.5)*scale*cover[0]+.5),y:(p.y-.5)*scale*cover[1]+.5};
}
export function projectLivePoint(point,view={}){
 if(view.flipY){const projected=projectLivePoint({x:point.x,y:1-point.y},{...view,flipY:false});return {x:projected.x,y:1-projected.y}}
 const cover=view.cover||[1,1],target={x:1-((point.x-.5)*cover[0]+.5),y:(point.y-.5)*cover[1]+.5};
 let p={...point};for(let i=0;i<8;i++){const q=sampleLivePoint(p,view);p={x:p.x+(q.x-target.x)/cover[0],y:p.y-(q.y-target.y)/cover[1]}}
 return p;
}
