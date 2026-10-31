export function cameraToMirror(point,sourceRatio,viewRatio){
 const cover=sourceRatio>viewRatio?{x:viewRatio/sourceRatio,y:1}:{x:1,y:sourceRatio/viewRatio};
 return {x:1-((point.x-.5)/cover.x+.5),y:(point.y-.5)/cover.y+.5};
}
function mapEyeBounds(bounds,point){
 return bounds?.map(box=>{const a=point({x:box.left,y:box.top}),b=point({x:box.right,y:box.bottom});return {left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}});
}
export function faceToMirror(face,sourceRatio,viewRatio){
 const center=cameraToMirror(face.center,sourceRatio,viewRatio),a=cameraToMirror({x:0,y:0},sourceRatio,viewRatio),b=cameraToMirror({x:1,y:1},sourceRatio,viewRatio);
 return {...face,center,width:face.width*Math.abs(b.x-a.x),height:face.height*Math.abs(b.y-a.y),eyes:face.eyes.map(p=>cameraToMirror(p,sourceRatio,viewRatio)).sort((a,b)=>a.x-b.x),eyeBounds:mapEyeBounds(face.eyeBounds,p=>cameraToMirror(p,sourceRatio,viewRatio)),nose:face.nose?cameraToMirror(face.nose,sourceRatio,viewRatio):null};
}
// Detection may cover raw pixels outside the visible mirror. Keep those eyes
// outside [0,1] after mapping, so a broad scan cannot bypass the on-screen gate.
export function scanFaceToMirror(face,region,screen){
 const point=p=>({x:1-(region.x+p.x*region.width-screen.x)/screen.width,y:(region.y+p.y*region.height-screen.y)/screen.height});
 return {...face,center:point(face.center),width:face.width*region.width/screen.width,height:face.height*region.height/screen.height,eyes:face.eyes.map(point).sort((a,b)=>a.x-b.x),eyeBounds:mapEyeBounds(face.eyeBounds,point),nose:face.nose?point(face.nose):null};
}
// Broad head-facing proxy from eye/nose geometry, not gaze estimation.
// Work in equal-scale axes and relative to the eye line so roll is tolerated.
export function facingMirror(face,viewRatio=1){
 const eyes=face?.eyes,nose=face?.nose;
 if(eyes?.length!==2||!nose||![...eyes,nose].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||!Number.isFinite(viewRatio)||viewRatio<=0)return false;
 const [a,b]=eyes,dx=(b.x-a.x)*viewRatio,dy=b.y-a.y,span2=dx*dx+dy*dy;
 if(span2<1e-8)return false;
 const nx=(nose.x-(a.x+b.x)/2)*viewRatio,ny=nose.y-(a.y+b.y)/2;
 const side=Math.abs((nx*dx+ny*dy)/span2),down=(dx*ny-dy*nx)/span2;
 return side<=.28&&down>=.10&&down<=1.05;
}
// Eye coordinates are already in the mirrored display crop, not raw camera space.
export function bothEyesVisible(face,project=point=>point){
 const inside=point=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1;
 if(face?.eyes?.length!==2||!face.eyes.every(eye=>inside(eye)&&inside(project(eye))))return false;
 if(!face.eyeBounds)return true;
 return face.eyeBounds.length===2&&face.eyeBounds.every(box=>[
  {x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.right,y:box.bottom},{x:box.left,y:box.bottom}
 ].every(p=>inside(p)&&inside(project(p))));
}
export class FaceTracker {
 constructor(onResult,onError=()=>{}){
  this.onResult=onResult;this.onError=onError;this.busy=false;
  this.worker=new Worker('./face-worker.js');
  this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Face tracker loading timed out')),45000);
   this.worker.onerror=event=>{clearTimeout(timer);const error=new Error(event.message||'Face tracker failed');reject(error);this.busy=false;onError(error)};
   this.worker.onmessage=({data})=>{
    if(data.type==='ready'){this.backend=data.backend;clearTimeout(timer);resolve(this)}
    if(data.type==='result'){const mapping=this.mapping;this.mapping=null;this.busy=false;onResult({...data,mapping})}
    if(data.type==='error'){clearTimeout(timer);this.busy=false;const error=new Error(data.message);reject(error);onError(error)}
   };
   this.worker.postMessage({type:'init'});
  });
 }
 async submit(canvas,timestamp,epoch,mapping=null){
  if(this.busy)return;this.busy=true;this.mapping=mapping;
  try{const image=await createImageBitmap(canvas);this.worker.postMessage({type:'frame',image,timestamp,epoch,width:canvas.width,height:canvas.height},[image])}
  catch(error){this.busy=false;this.onError(error)}
 }
}
