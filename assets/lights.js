// Three bright bursts aligned to the loudness peaks of the 1.6 s come-closer recording.
// Precomputed once: no live audio analysis or extra frame processing.
export const APPROACH_BLINKS=[[0,.03],[150,1],[400,.03],[500,1],[700,.03],[1050,1],[1200,.03],[1600,1]].map(([ms,opacity])=>({offset:ms/1600,opacity,easing:'steps(1,end)'}));

// Equal spacing along each edge, with a shared target pitch and unique corners.
export function lampPositions(width,height,diameter,inset){
 const x0=inset+diameter/2,y0=inset+diameter/2,x1=width-x0,y1=height-y0;
 const columns=Math.max(1,Math.round((x1-x0)/(diameter*2.6))),rows=Math.max(1,Math.round((y1-y0)/(diameter*2.6))),positions=[];
 for(let x=0;x<=columns;x++){const px=x0+(x1-x0)*x/columns;positions.push({x:px,y:y0},{x:px,y:y1})}
 for(let y=1;y<rows;y++){const py=y0+(y1-y0)*y/rows;positions.push({x:x0,y:py},{x:x1,y:py})}
 return positions;
}
export function layoutLights(element){
 const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const diameter=Math.min(74,Math.max(30,Math.min(rect.width,rect.height)*.07)),inset=Math.min(18,Math.max(9,Math.min(rect.width,rect.height)*.015));
 const lamps=lampPositions(rect.width,rect.height,diameter,inset).map(p=>{const lamp=document.createElement('i');lamp.style.left=p.x+'px';lamp.style.top=p.y+'px';return lamp});element.replaceChildren(...lamps);
}
