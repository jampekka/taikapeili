// Inference runs here, never in the reveal's rendering path.
importScripts('./vendor/mediapipe/vision_bundle.js');
let tracker,fallback=false;
const pixels=new OffscreenCanvas(1,1),pixelsContext=pixels.getContext('2d',{willReadFrequently:true});
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const canvas=new OffscreenCanvas(1,1);
   if(!canvas.getContext('webgl2')||!await Vision.FilesetResolver.isSimdSupported()){
    importScripts('./vendor/face-api.min.js');
    faceapi.env.setEnv({Canvas:OffscreenCanvas,Image:class{},Video:class{},ImageData,fetch:self.fetch.bind(self),createCanvasElement:()=>new OffscreenCanvas(1,1)});
    await faceapi.tf.setBackend('cpu');
    await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('./models'),faceapi.nets.faceLandmark68TinyNet.loadFromUri('./models')]);
    fallback=true;self.postMessage({type:'ready',backend:'face-api CPU worker'});return;
   }
   const files=await Vision.FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
   tracker=await Vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'./models/face_landmarker.task',delegate:'CPU'},canvas,runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
   self.postMessage({type:'ready',backend:'MediaPipe worker'});return;
  }
  if(data.type==='frame'){
   const began=performance.now();let result;
   if(fallback){
    pixels.width=data.width;pixels.height=data.height;pixelsContext.drawImage(data.image,0,0);data.image.close();
    const rgba=pixelsContext.getImageData(0,0,data.width,data.height).data,rgb=new Uint8Array(data.width*data.height*3);
    for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2]}
    const tensor=faceapi.tf.tensor3d(rgb,[data.height,data.width,3],'int32');
    let detections;try{detections=await faceapi.detectAllFaces(tensor,new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.5})).withFaceLandmarks(true)}finally{tensor.dispose()}
    const eye=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length/data.width,y:points.reduce((s,p)=>s+p.y,0)/points.length/data.height});
    const eyeBounds=points=>({left:Math.min(...points.map(p=>p.x))/data.width,right:Math.max(...points.map(p=>p.x))/data.width,top:Math.min(...points.map(p=>p.y))/data.height,bottom:Math.max(...points.map(p=>p.y))/data.height});
    const faces=detections.map(d=>{const b=d.detection.box,nose=d.landmarks.getNose()[3],left=d.landmarks.getLeftEye(),right=d.landmarks.getRightEye();return {center:{x:(b.x+b.width/2)/data.width,y:(b.y+b.height/2)/data.height},width:b.width/data.width,height:b.height/data.height,score:d.detection.score,eyes:[eye(left),eye(right)],eyeBounds:[eyeBounds(left),eyeBounds(right)],nose:{x:nose.x/data.width,y:nose.y/data.height}}}).sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,1);
    self.postMessage({type:'result',faces,epoch:data.epoch,width:data.width,height:data.height,sampledAt:data.timestamp,inferenceMs:performance.now()-began});return;
   }
   try{result=tracker.detectForVideo(data.image,data.timestamp)}finally{data.image.close()}
   const faces=result.faceLandmarks.map(points=>{
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const mid=(a,b)=>({x:(points[a].x+points[b].x)/2,y:(points[a].y+points[b].y)/2});
    const eyeBounds=indices=>{const ps=indices.map(i=>points[i]);return {left:Math.min(...ps.map(p=>p.x)),right:Math.max(...ps.map(p=>p.x)),top:Math.min(...ps.map(p=>p.y)),bottom:Math.max(...ps.map(p=>p.y))}};
    return {center:{x:(left+right)/2,y:(top+bottom)/2},width:right-left,height:bottom-top,score:1,eyes:[mid(33,133),mid(362,263)],eyeBounds:[eyeBounds([33,7,163,144,145,153,154,155,133,246,161,160,159,158,157,173]),eyeBounds([263,249,390,373,374,380,381,382,362,466,388,387,386,385,384,398])],nose:{x:points[1].x,y:points[1].y}};
   });
   self.postMessage({type:'result',faces,epoch:data.epoch,width:data.width,height:data.height,sampledAt:data.timestamp,inferenceMs:performance.now()-began});
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)})}
};
