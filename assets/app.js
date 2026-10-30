import {transformSnapshot} from './effects.js';
import {PersonPresence,applyPersonMask} from './presence.js';
import {MirrorRenderer} from './renderer.js';
import {MirrorRun,delay} from './run.js';
import {levelPortrait} from './portrait.js';
import {HorrorAudio} from './audio.js';
import {DEFAULT_MODEL,requestServerImage,safeError} from './provider.js';
const $=id=>document.getElementById(id),mirror=$('mirror'),video=$('camera'),glass=$('glass');
const params=new URLSearchParams(location.search),debug=params.has('debug'),fixture=params.get('test'),muted=params.get('mute')==='1';
const revealMs=650,comeMs=3000,lookMs=4000,startDelayMs=2000,laughDelayMs=1500;
let trackedFaces=[],activeCue=null,liveEyeFocus=null,liveEyes=null,moveFixture=null;
let source=null,stream=null,detector=null,segmenter=null,segmenterPromise=null,raf=0,epoch=0,starting=false,lastScan=-Infinity,lastFace=null,configured=false;
let config={provider:'local',model:DEFAULT_MODEL,morph:.7,volume:.65,texts:false};
const stats={detections:0,faces:0,captures:0,reveals:0,apiCalls:0,providerMs:null,imageMs:null,frameAgeMs:null,error:'none',sound:'locked',mask:'not needed',eyes:'not measured'};
const events=[],audio=new HorrorAudio();audio.setVolume(config.volume);
const frame=document.createElement('canvas'),scan=document.createElement('canvas');
const ctx=frame.getContext('2d',{alpha:false}),scanCtx=scan.getContext('2d',{alpha:false});
const renderer=new MirrorRenderer($('atmosphere'),{revealCanvas:$('reflection'),onTick:()=>drawTracking(trackedFaces),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
const run=new MirrorRun(state=>{
 mirror.dataset.phase=state==='running'?'processing':state==='reveal'?'reveal':'live';
 mirror.dataset.requesting=String(state==='running');
 if(state==='finished')log('Waiting for 3s without a face');
 if(state==='idle'||state==='finished'){activeCue=null;$('ritualText').hidden=true;audio.stop('whisper');renderer.waiting=false}
 if(state==='running')renderer.waiting=true;
 if(state==='reveal'||state==='after')renderer.waiting=false;
 if(state==='error'){stats.error=safeError(run.error);$('errorText').textContent=stats.error;$('runError').hidden=false;log(stats.error)}
 updateDebug();
});
function log(message){events.unshift(`${new Date().toLocaleTimeString()} ${safeError(message)}`);events.length=Math.min(10,events.length);updateDebug()}
function updateDebug(){if(!debug)return;const active=run.active;$('debugState').textContent=[`state       ${run.state} · ${run.armed?'armed':'needs 3s absence'}`,`provider    ${config.provider==='local'?'dummy (no API calls)':config.model}`,`face scans  ${stats.detections} · ${stats.faces} faces`,`capture     ${stats.captures}`,`sequence    ${active?.sequenceDone?'finished':active?'running':'—'}`,`image       ${active?.imageReady?'ready':active?.generateAfterSequence&&!active.sequenceDone?'waiting for final capture':active?'working':'—'}`,`image time  ${stats.imageMs===null?'—':Math.round(stats.imageMs)+'ms'}`,`frame age   ${stats.frameAgeMs===null?'—':Math.round(stats.frameAgeMs)+'ms at reveal'}`,`API time    ${stats.providerMs===null?'—':Math.round(stats.providerMs)+'ms'}`,`API calls   ${stats.apiCalls}`,`reveals     ${stats.reveals}`,`eyes        ${stats.eyes}`,`mask        ${stats.mask}`,`renderer    ${renderer.backend}`,`audio       ${muted?'muted':audio.status} · ${stats.sound}`,`last error  ${stats.error}`].join('\n');$('debugEvents').textContent=events.join('\n')}
function playActiveCue(){
 if(muted||!activeCue||activeCue.played||performance.now()>=activeCue.until)return;
 const result=audio.say(activeCue.id);stats.sound=`whisper ${activeCue.id}: ${result}`;
 if(result===activeCue.id){activeCue.played=true;log(`Whisper played: ${activeCue.id}`)}
 updateAudioPrompt();updateDebug();
}
function cue(text,id,duration){activeCue={id,played:false,until:performance.now()+duration};$('ritualText').textContent=text;$('ritualText').hidden=!config.texts;log(text);playActiveCue()}
async function sequence(signal){
 log('Lead-in delay · 2s');await delay(startDelayMs,signal);
 cue('Tule lähemmäksi.','come',comeMs);await delay(comeMs,signal);
 const secretMs=Math.ceil(audio.duration('secret',6)*1000)+650;
 cue('Näytän sinulle salaisuuden, älä kerro tästä kellekään.','secret',secretMs);await delay(secretMs,signal);
 cue('Katso syvälle silmiisi.','look',lookMs);await delay(lookMs,signal);
 activeCue=null;$('ritualText').hidden=true;log('Sequence finished');updateDebug();
}
async function loadDetector(){
 if(detector)return;
 await import('./vendor/face-api.min.js');const api=globalThis.faceapi;
 let backend='cpu';if(params.get('backend')!=='cpu'){try{await api.tf.setBackend('webgl');backend=api.tf.getBackend()}catch{}}
 if(backend!=='webgl')await api.tf.setBackend('cpu');
 await Promise.all([api.nets.tinyFaceDetector.loadFromUri('./models'),api.nets.faceLandmark68TinyNet.loadFromUri('./models')]);
 detector={tf:api.tf,async detect(image,landmarks=false){
  const task=api.detectAllFaces(image,new api.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.5}));
  const results=landmarks?await task.withFaceLandmarks(true):(await task).map(detection=>({detection}));
  return results.map(d=>{const b=d.detection.box,width=image.width,height=image.height;const eye=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length/width,y:points.reduce((s,p)=>s+p.y,0)/points.length/height});return {center:{x:(b.x+b.width/2)/width,y:(b.y+b.height/2)/height},width:b.width/width,height:b.height/height,score:d.detection.score,eyes:d.landmarks?[eye(d.landmarks.getLeftEye()),eye(d.landmarks.getRightEye())]:null}}).sort((a,b)=>b.width*b.height-a.width*a.height);
 }};log(`Face detector ready · ${api.tf.getBackend()}`);
}
function capture(){
 const rect=glass.getBoundingClientRect(),ratio=rect.width/Math.max(1,rect.height);frame.height=Math.min(960,Math.round(720/ratio));frame.width=Math.round(frame.height*ratio);
 const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
 if(!width||!height)return false;
 const scale=Math.max(frame.width/width,frame.height/height);ctx.save();ctx.translate(frame.width,0);ctx.scale(-1,1);ctx.drawImage(source,(frame.width-width*scale)/2,(frame.height-height*scale)/2,width*scale,height*scale);ctx.restore();return true;
}
function snapshot(){const image=document.createElement('canvas');image.width=frame.width;image.height=frame.height;image.getContext('2d').drawImage(frame,0,0);return image}
function warmForeground(){if(!segmenterPromise)segmenterPromise=new PersonPresence().load(detector.tf);return segmenterPromise}
async function latestDummy(face,signal){
 moveFixture?.(performance.now());
 if(!capture())throw new Error('Camera frame unavailable');
 const image=snapshot(),capturedAt=performance.now();stats.captures++;log('Late dummy capture');
 const result=await dummy(image,lastFace||face,signal);return {...result,capturedAt};
}
async function foreground(image){
 try{
  segmenter=await warmForeground();const result=await segmenter.detect(image,{force:true});stats.mask=result.present?'snapshot only':'unavailable · vignette';return result.present?result.mask:null;
 }catch{stats.mask='unavailable · vignette';return null}
}
async function dummy(image,face,signal){
 const precise=await detector.detect(image,true).catch(()=>[]),aligned=precise[0]||face;
 const fallbackEyes=[{x:aligned.center.x-aligned.width*.18,y:aligned.center.y-aligned.height*.08},{x:aligned.center.x+aligned.width*.18,y:aligned.center.y-aligned.height*.08}];
 aligned.eyes ||= fallbackEyes;stats.eyes=precise[0]?'landmarks · levelled':'estimated · levelled';
 const [edited,mask]=await Promise.all([transformSnapshot({image,face:aligned,effect:'zombie',intensity:1}),foreground(image)]);
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 return levelPortrait(applyPersonMask(edited,mask),aligned);
}
function upload(image){const small=document.createElement('canvas'),scale=Math.min(1,512/Math.max(image.width,image.height));small.width=Math.round(image.width*scale);small.height=Math.round(image.height*scale);small.getContext('2d').drawImage(image,0,0,small.width,small.height);return small.toDataURL('image/jpeg',.8)}
async function generate(image,face,signal){
 const started=performance.now();stats.imageMs=null;stats.providerMs=null;
 let result;
 if(config.provider==='local')result=await latestDummy(face,signal);
 else{
  stats.apiCalls++;
  try{const response=await requestServerImage({imageData:upload(image),model:config.model,effect:'zombie',ratio:image.width/image.height,signal});stats.providerMs=response.providerMs;const edited=new Image();edited.src=response.dataUrl;await edited.decode();result={image:edited,focus:face.center}}
  catch(error){if(signal.aborted)throw error;log(`Image provider failed → dummy backup: ${safeError(error)}`);result=await latestDummy(face,signal)}
 }
 if(debug&&params.has('delay'))await delay(Math.min(30000,Number(params.get('delay'))||0),signal);
 stats.imageMs=performance.now()-started;log(`Image ready · ${Math.round(stats.imageMs)}ms`);return result;
}
function updateLiveEyes(faces){
 const eyes=faces[0]?.eyes;if(eyes?.length===2){liveEyes=eyes;liveEyeFocus={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2}}
}
async function beforeReveal(result,signal){
 // Take a final landmark measurement with the lights still on. The image itself
 // remains the original captured portrait; only its on-screen anchor changes.
 if(capture()){
  const eyesFrame=document.createElement('canvas');eyesFrame.height=240;eyesFrame.width=Math.max(1,Math.round(240*frame.width/frame.height));eyesFrame.getContext('2d').drawImage(frame,0,0,eyesFrame.width,eyesFrame.height);
  const faces=await detector.detect(eyesFrame,true).catch(()=>[]);if(signal.aborted)throw new DOMException('Cancelled','AbortError');run.observeFace(faces.length>0,performance.now());if(signal.aborted)throw new DOMException('Cancelled','AbortError');updateLiveEyes(faces);if(faces.length)trackedFaces=faces;
 }
 const latest=liveEyeFocus||{x:.5,y:.42},displayEyes=(liveEyes||[latest]).map(eye=>renderer.projectPoint(eye)),target={x:displayEyes.reduce((s,p)=>s+p.x,0)/displayEyes.length,y:displayEyes.reduce((s,p)=>s+p.y,0)/displayEyes.length};log(`Reveal eyes: captured ${result.focus.y.toFixed(3)} → latest ${target.y.toFixed(3)}`);
 return {...result,target};
}
async function reveal(result,signal){
 stats.frameAgeMs=result.capturedAt===undefined?null:performance.now()-result.capturedAt;
 $('ritualText').hidden=true;renderer.show(result.image,revealMs,result.focus,result.target);stats.sound=muted?'muted':audio.play();stats.reveals++;mirror.dataset.reveals=String(stats.reveals);log('Reveal');await delay(revealMs,signal);renderer.clearReveal();
}
async function afterReveal(signal){
 await delay(laughDelayMs,signal);stats.sound=muted?'muted':audio.laugh();log('Nelson laugh · 1.5s after reveal');
 await delay(audio.duration('laugh',1)*1000,signal);
}
function trigger(face){
 if(run.state!=='idle'||!run.armed||!source)return;
 const local=config.provider==='local',image=local?null:snapshot();if(!local)stats.captures++;stats.error='none';stats.frameAgeMs=null;stats.imageMs=null;stats.providerMs=null;
 if(local)warmForeground().catch(()=>{});log(local?'Face → sequence → final dummy capture':'Face → capture + sequence + image');
 run.start({generate:signal=>generate(image,face,signal),generateAfterSequence:local,sequence,beforeReveal,reveal,afterReveal});
}
function drawTracking(faces){
 const c=$('tracking');c.hidden=!debug||!$('boxes').checked||run.state==='reveal';if(c.hidden)return;
 const r=glass.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);if(c.width!==w||c.height!==h){c.width=w;c.height=h}
 const t=c.getContext('2d');t.clearRect(0,0,w,h);t.strokeStyle='#9dffb0';t.lineWidth=2;
 for(const f of faces){const left=f.center.x-f.width/2,top=f.center.y-f.height/2;const corners=[{x:left,y:top},{x:left+f.width,y:top},{x:left+f.width,y:top+f.height},{x:left,y:top+f.height}];t.beginPath();for(let side=0;side<4;side++)for(let i=0;i<8;i++){const a=corners[side],b=corners[(side+1)%4],p=renderer.projectPoint({x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8});if(!side&&!i)t.moveTo(p.x*w,p.y*h);else t.lineTo(p.x*w,p.y*h)}t.closePath();t.stroke();
  if(f.eyes?.length===2){t.strokeStyle='#ffdf65';t.fillStyle='#ffdf65';for(const eye of f.eyes){const p=renderer.projectPoint(eye),x=p.x*w,y=p.y*h;t.beginPath();t.arc(x,y,4,0,Math.PI*2);t.stroke();t.beginPath();t.moveTo(x-9,y);t.lineTo(x+9,y);t.moveTo(x,y-9);t.lineTo(x,y+9);t.stroke()}t.strokeStyle='#9dffb0'}
 }
}

async function loop(now){
 const current=epoch;moveFixture?.(now);
 if(source&&run.state!=='reveal'&&now-lastScan>=300){
  lastScan=now;
  try{if(capture()){
   scan.height=240;scan.width=Math.max(1,Math.round(240*frame.width/frame.height));scanCtx.drawImage(frame,0,0,scan.width,scan.height);
   const faces=await detector.detect(scan,debug&&$('boxes').checked&&run.state!=='idle');if(current!==epoch)return;updateLiveEyes(faces);trackedFaces=faces;lastFace=faces[0]||null;stats.detections++;stats.faces=faces.length;mirror.dataset.faces=String(faces.length);drawTracking(faces);
   run.observeFace(!!lastFace,performance.now());if(lastFace)trigger(lastFace);updateDebug();
  }}catch(error){log(`Detection: ${safeError(error)}`)}
 }
 if(current===epoch&&source)raf=requestAnimationFrame(loop);
}
function stop(){moveFixture=null;liveEyeFocus=null;liveEyes=null;activeCue=null;trackedFaces=[];epoch++;cancelAnimationFrame(raf);run.reset();renderer.stop();renderer.clearReveal();audio.stop();$('ritualText').hidden=true;stream?.getTracks().forEach(track=>track.stop());stream=null;source=null;video.srcObject=null;starting=false}
async function start(){
 if(starting||source)return;starting=true;const current=++epoch;$('startup').hidden=false;$('enable').hidden=true;$('message').textContent='Opening the mirror…';
 try{
  const ready=Promise.all([audio.prepare().catch(error=>log(safeError(error))),loadDetector(),fetch('/api/mirror/config').then(r=>r.json()).then(c=>{configured=!!c.configured;$('serverKeyStatus').textContent=configured?'Server configured · dummy is the default':'Dummy mode · no API needed'}).catch(()=>{})]);
  if(fixture){const image=fixture==='portrait'?new Image():document.createElement('canvas');if(fixture==='portrait'){image.src='portrait.jpg';await image.decode()}else{image.width=600;image.height=800;image.getContext('2d').fillRect(0,0,600,800)}if(current!==epoch)return;source=image;
   if(debug&&fixture==='portrait'&&(params.has('move')||params.has('presenceCycle'))){
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d'),began=performance.now();
    moveFixture=now=>{const elapsed=now-began;context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);if(params.has('presenceCycle')&&((elapsed>=4000&&elapsed<8000)||(elapsed>=25000&&elapsed<29000)))return;context.drawImage(image,0,params.has('move')&&elapsed>3000?canvas.height*.15:0)};moveFixture(began);source=canvas;
   }
   video.hidden=true}
  else{const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});if(current!==epoch){camera.getTracks().forEach(t=>t.stop());return}stream=camera;video.srcObject=camera;await video.play();source=video}
  await ready;if(current!==epoch)return;$('startup').hidden=true;mirror.dataset.ready='true';mirror.dataset.phase='live';renderer.start(source);lastScan=-Infinity;raf=requestAnimationFrame(loop);log('Mirror ready · dummy default');
 }catch(error){if(current!==epoch)return;stop();$('startup').hidden=false;$('message').textContent=`Camera/detector: ${safeError(error)}`;$('enable').hidden=false}
 finally{if(current===epoch)starting=false}
}
function updateAudioPrompt(){
 const ready=audio.status==='running';$('audioGate').hidden=ready;mirror.hidden=!ready;$('debug').hidden=!debug||!ready;
 if(ready){if(!source&&!starting&&!document.hidden)void start()}
 else{if(source||starting)stop();$('audioGateMessage').textContent=audio.error?'Äänten lataus epäonnistui. Yritä uudelleen.':'Napauta avataksesi peilin ja käynnistääksesi äänet.'}
}
audio.onStateChange=updateAudioPrompt;
async function unlock(){
 $('startMirror').disabled=true;
 try{if(!await audio.unlock())throw new Error('Audio is still locked');updateAudioPrompt()}
 catch(error){$('audioGateMessage').textContent=safeError(error)}
 finally{$('startMirror').disabled=false}
}
$('startMirror').addEventListener('click',unlock);
$('enable').addEventListener('click',()=>{stop();updateAudioPrompt()});$('retry').addEventListener('click',()=>{$('runError').hidden=true;run.reset()});
if(debug){
 $('debug').hidden=audio.status!=='running';$('apiModel').value=DEFAULT_MODEL;
 $('providerForm').addEventListener('submit',e=>{e.preventDefault();if(run.state!=='idle'){log('Finish the current run before changing provider');return}if(!configured){log('Server provider unavailable');return}config.provider='server';config.model=$('apiModel').value||DEFAULT_MODEL;$('providerStatus').textContent=`Remote · ${config.model}`;updateDebug()});
 $('useLocal').addEventListener('click',()=>{if(run.state!=='idle')return;config.provider='local';$('providerStatus').textContent='Dummy · no API calls';updateDebug()});
 $('morph').addEventListener('input',e=>{config.morph=Number(e.target.value)/100;renderer.strength=config.morph});
 $('volume').addEventListener('input',e=>audio.setVolume(Number(e.target.value)/100));
 $('boxes').addEventListener('change',()=>drawTracking(trackedFaces));
 $('showTexts').addEventListener('change',e=>{config.texts=e.target.checked;$('ritualText').hidden=!config.texts||!activeCue});
 $('testSound').addEventListener('click',async()=>{await unlock();stats.sound=audio.play();updateDebug()});
 $('testScare').addEventListener('click',()=>{if(run.state==='idle'&&lastFace&&capture())trigger(lastFace)});
 $('providerStatus').textContent='Dummy · no API calls';setInterval(updateDebug,250);
}
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else updateAudioPrompt()});
// Try autoplay; no camera or detection starts until audio is ready.
audio.prepare().then(()=>{updateAudioPrompt();if(audio.status!=='running')audio.context.resume().then(updateAudioPrompt).catch(()=>{})}).catch(updateAudioPrompt);
