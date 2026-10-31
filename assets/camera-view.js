// Unmirrored camera crop shared by display, detection, and final capture.
export const CAMERA_CONTROLS=[
 {key:'cameraZoom',label:'Camera zoom',min:1,max:3,step:.01,value:1},
 {key:'cameraPanX',label:'Pan image horizontally',min:-1,max:1,step:.01,value:0},
 {key:'cameraPanY',label:'Pan image vertically',min:-1,max:1,step:.01,value:0}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cameraCrop(width,height,viewRatio,{cameraZoom=1,cameraPanX=0,cameraPanY=0}={}){
 const zoom=clamp(cameraZoom,1,3),w=Math.min(width,height*viewRatio)/zoom,h=w/viewRatio;
 return {x:(width-w)*(1+clamp(cameraPanX,-1,1))/2,y:(height-h)*(1-clamp(cameraPanY,-1,1))/2,width:w,height:h};
}
export function frameEyes(crop,width,height,eyes,targetY=.18){
 if(eyes?.length!==2)return null;
 const x=crop.x+(1-(eyes[0].x+eyes[1].x)/2)*crop.width,y=crop.y+(eyes[0].y+eyes[1].y)/2*crop.height;
 return {cameraPanX:width-crop.width>1?clamp(2*(x-crop.width*.5)/(width-crop.width)-1,-1,1):0,cameraPanY:height-crop.height>1?clamp(1-2*(y-crop.height*targetY)/(height-crop.height),-1,1):0};
}
