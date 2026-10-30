import {transformSnapshot} from './effects.js';
import {MirrorCycle} from './cycle.js';
const mirror=document.getElementById('mirror'),glass=document.getElementById('glass'),video=document.getElementById('camera'),reflection=document.getElementById('reflection'),startup=document.getElementById('startup'),message=document.getElementById('message'),enable=document.getElementById('enable');
const params=new URLSearchParams(location.search);
// Test sources use the exact same detection/reveal pipeline without needing camera hardware.
const fixture=params.get('test');
const effect=['zombie','ghost','aged'].includes(params.get('effect'))?params.get('effect'):'zombie';
let stream=null,detector=null,detectorPromise=null,source=null,raf=null,lastScan=-Infinity,lastVideoTime=-1,generation=0,wakeLock=null,fixtureImage=null,opening=false;
const frame=document.createElement('canvas'),scan=document.createElement('canvas');
const frameContext=frame.getContext('2d',{alpha:false}),scanContext=scan.getContext('2d',{alpha:false});
const cycle=new MirrorCycle();
function phase(p){mirror.dataset.phase=p}
function notify(text,canRetry=false){mirror.dataset.ready='false';message.textContent=text;enable.hidden=!canRetry;startup.hidden=false}
async function loadDetector(){
 if(detector)return detector;
 if(!detectorPromise)detectorPromise=(async()=>{
  await import('./vendor/face-api.min.js');const api=globalThis.faceapi;
  // CPU inference also works in Safari/private sessions without WebGL.
  await api.tf.setBackend('cpu');
  await Promise.all([api.nets.tinyFaceDetector.loadFromUri('./models'),api.nets.faceLandmark68TinyNet.loadFromUri('./models')]);
  return {async detect(input){
   const results=await api.detectAllFaces(input,new api.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.62})).withFaceLandmarks(true);
   return results.map(d=>{const box=d.detection.box;const eye=points=>({x:points.reduce((n,p)=>n+p.x,0)/points.length/input.width,y:points.reduce((n,p)=>n+p.y,0)/points.length/input.height});return {eyes:[eye(d.landmarks.getLeftEye()),eye(d.landmarks.getRightEye())],center:{x:(box.x+box.width/2)/input.width,y:(box.y+box.height/2)/input.height},width:box.width/input.width,height:box.height/input.height,score:d.detection.score}});
  }};
 })().catch(error=>{detectorPromise=null;throw error});
 detector=await detectorPromise;return detector;
}
function stop(){generation++;cancelAnimationFrame(raf);raf=null;cycle.reset();phase('live');if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;source=null;opening=false;if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
function dimensions(){const rect=glass.getBoundingClientRect();const ratio=Math.max(.25,rect.width/Math.max(1,rect.height));const height=Math.min(1200,Math.round(900/ratio));const width=Math.round(height*ratio);if(frame.width!==width||frame.height!==height){frame.width=width;frame.height=height}const sh=240,sw=Math.max(1,Math.round(sh*ratio));if(scan.width!==sw||scan.height!==sh){scan.width=sw;scan.height=sh}}
function drawFrame(){
 dimensions();const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;
 if(!sw||!sh)return false;const scale=Math.max(frame.width/sw,frame.height/sh),w=sw*scale,h=sh*scale;
 frameContext.save();frameContext.fillStyle='#10120f';frameContext.fillRect(0,0,frame.width,frame.height);frameContext.translate(frame.width,0);frameContext.scale(-1,1);frameContext.drawImage(source,(frame.width-w)/2,(frame.height-h)/2,w,h);frameContext.restore();return true;
}

function drawFixture(){if(!fixtureImage)return;const r=glass.getBoundingClientRect();reflection.width=Math.max(1,Math.round(r.width));reflection.height=Math.max(1,Math.round(r.height));const ctx=reflection.getContext('2d');const scale=Math.max(reflection.width/fixtureImage.width,reflection.height/fixtureImage.height);ctx.save();ctx.translate(reflection.width,0);ctx.scale(-1,1);ctx.drawImage(fixtureImage,(reflection.width-fixtureImage.width*scale)/2,(reflection.height-fixtureImage.height*scale)/2,fixtureImage.width*scale,fixtureImage.height*scale);ctx.restore();reflection.style.opacity='1'}
async function reveal(face,ticket,run){
 // Freeze the exact frame used for detection. Camera playback continues underneath.
 const snapshot=document.createElement('canvas');snapshot.width=frame.width;snapshot.height=frame.height;snapshot.getContext('2d').drawImage(frame,0,0);
 try{const edited=await transformSnapshot({image:snapshot,face,effect});
  if(run!==generation||!cycle.complete(ticket,performance.now()))return;
  reflection.width=edited.width;reflection.height=edited.height;reflection.getContext('2d').drawImage(edited,0,0);phase('reveal');mirror.dataset.reveals=String(Number(mirror.dataset.reveals||0)+1);
 }catch(error){console.error('Mirror transformation failed',error);cycle.fail(ticket,performance.now());phase('live')}
}
async function loop(now){
 const run=generation;if(!source||document.hidden)return;
 if(now-lastScan>=400&&(fixture||video.currentTime!==lastVideoTime)){
  lastScan=now;lastVideoTime=video.currentTime;
  try{if(drawFrame()){
   scanContext.drawImage(frame,0,0,scan.width,scan.height);
   const detected=(await detector.detect(scan)).filter(f=>f.width>.1&&f.height>.08).sort((a,b)=>b.width*b.height-a.width*a.height);
   if(run!==generation)return;
   const observedAt=performance.now();lastScan=observedAt;
   mirror.dataset.faces=String(detected.length);const action=cycle.observe(detected[0]||null,observedAt);mirror.dataset.detections=String(Number(mirror.dataset.detections||0)+1);
   if(action.hide){phase('live');if(fixture)drawFixture()}
   if(action.capture){phase('processing');void reveal(detected[0],action.ticket,run)}
  }}catch(error){console.error('Face detection failed',error);stop();phase('error');notify('Face detection could not start. Tap to try again.',true);return}
 }
 raf=requestAnimationFrame(loop);
}
async function start(){
 if(opening||stream)return;opening=true;const run=++generation;enable.hidden=true;notify('Opening the mirror…');phase('starting');
 try{
  const model=loadDetector();model.catch(()=>{});
  if(fixture){
   if(fixture==='portrait'){fixtureImage=new Image();fixtureImage.src='portrait.jpg';await fixtureImage.decode();source=fixtureImage}
   else{const blank=document.createElement('canvas');blank.width=600;blank.height=800;blank.getContext('2d').fillRect(0,0,600,800);source=blank;fixtureImage=blank}
   await model;if(run!==generation)return;drawFixture();
  }else{
   if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('camera unavailable'),{name:'NotSupportedError'});
   // Request permission immediately; detection assets initialize at the same time.
   const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});
   if(run!==generation){camera.getTracks().forEach(t=>t.stop());return}stream=camera;video.srcObject=camera;
   await video.play();source=video;notify('The mirror is waking up…');await model;if(run!==generation)return;
   try{wakeLock=await navigator.wakeLock?.request('screen')}catch{}
  }
  mirror.dataset.ready='true';phase('live');cycle.reset();lastScan=-Infinity;lastVideoTime=-1;raf=requestAnimationFrame(loop);
 }catch(error){if(run!==generation)return;console.error('Mirror startup failed',error);stop();phase('error');
  const permission=['NotAllowedError','SecurityError'].includes(error.name);const missing=['NotFoundError','NotSupportedError'].includes(error.name);
  notify(permission?'Allow the camera to open the mirror.':missing?'No camera is available. Connect one, then try again.':'The mirror could not start. Tap to try again.',true);
 }finally{if(run===generation)opening=false}
}
enable.addEventListener('click',()=>{stop();start()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',event=>{if(event.persisted)start()});
window.addEventListener('resize',()=>{cycle.reset();phase('live');if(fixture)drawFixture()});
start();
