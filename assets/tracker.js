export function cameraToMirror(point,sourceRatio,viewRatio){
 const cover=sourceRatio>viewRatio?{x:viewRatio/sourceRatio,y:1}:{x:1,y:sourceRatio/viewRatio};
 return {x:1-((point.x-.5)/cover.x+.5),y:(point.y-.5)/cover.y+.5};
}
export function faceToMirror(face,sourceRatio,viewRatio){
 const center=cameraToMirror(face.center,sourceRatio,viewRatio),a=cameraToMirror({x:0,y:0},sourceRatio,viewRatio),b=cameraToMirror({x:1,y:1},sourceRatio,viewRatio);
 return {...face,center,width:face.width*Math.abs(b.x-a.x),height:face.height*Math.abs(b.y-a.y),eyes:face.eyes.map(p=>cameraToMirror(p,sourceRatio,viewRatio)).sort((a,b)=>a.x-b.x)};
}
// Eye coordinates are already in the mirrored display crop, not raw camera space.
export function bothEyesVisible(face,project=point=>point){
 const inside=point=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1;
 return face?.eyes?.length===2&&face.eyes.every(eye=>inside(eye)&&inside(project(eye)));
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
    if(data.type==='result'){this.busy=false;onResult(data)}
    if(data.type==='error'){clearTimeout(timer);this.busy=false;const error=new Error(data.message);reject(error);onError(error)}
   };
   this.worker.postMessage({type:'init'});
  });
 }
 async submit(canvas,timestamp,epoch){
  if(this.busy)return;this.busy=true;
  try{const image=await createImageBitmap(canvas);this.worker.postMessage({type:'frame',image,timestamp,epoch,width:canvas.width,height:canvas.height},[image])}
  catch(error){this.busy=false;this.onError(error)}
 }
}
