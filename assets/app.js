import {transformSnapshot} from './effects.js';
import {PersonPresence,applyPersonMask} from './presence.js';
import {MirrorRenderer} from './renderer.js';
import {MirrorRun,delay} from './run.js';
import {levelPortrait} from './portrait.js';
import {HorrorAudio} from './audio.js';
import {DEFAULT_MODEL,requestServerImage,safeError} from './provider.js';
const $=id=>document.getElementById(id),mirror=$('mirror'),video=$('camera'),glass=$('glass');
const params=new URLSearchParams(location.search),debug=params.has('debug'),fixture=params.get('test'),muted=params.get('mute')==='1';
const revealMs=650,comeMs=3000,lookMs=4000;
let source=null,stream=null,detector=null,segmenter=null,segmenterPromise=null,raf=0,epoch=0,starting=false,lastScan=-Infinity,lastFace=null,configured=false;
let config={provider:'local',model:DEFAULT_MODEL,morph:.7,volume:.65};
const stats={detections:0,faces:0,captures:0,reveals:0,apiCalls:0,providerMs:null,imageMs:null,error:'none',sound:'locked',mask:'not needed',eyes:'not measured'};
const events=[],audio=new HorrorAudio();audio.setVolume(config.volume);
const frame=document.createElement('canvas'),scan=document.createElement('canvas');
const ctx=frame.getContext('2d',{alpha:false}),scanCtx=scan.getContext('2d',{alpha:false});
const renderer=new MirrorRenderer($('atmosphere'),{revealCanvas:$('reflection'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
const run=new MirrorRun(state=>{
 mirror.dataset.phase=state==='running'?'processing':state==='idle'?'live':state;
 mirror.dataset.requesting=String(state==='running');
 if(state==='idle'){$('ritualText').hidden=true;renderer.waiting=false}
 if(state==='running')renderer.waiting=true;
 if(state==='reveal')renderer.waiting=false;
 if(state==='error'){stats.error=safeError(run.error);$('errorText').textContent=stats.error;$('runError').hidden=false;log(stats.error)}
 updateDebug();
});
function log(message){events.unshift(`${new Date().toLocaleTimeString()} ${safeError(message)}`);events.length=Math.min(10,events.length);updateDebug()}
function updateDebug(){if(!debug)return;const active=run.active;$('debugState').textContent=[`state       ${run.state}`,`provider    ${config.provider==='local'?'dummy (no API calls)':config.model}`,`face scans  ${stats.detections} · ${stats.faces} faces`,`capture     ${stats.captures}`,`sequence    ${active?.sequenceDone?'finished':active?'running':'—'}`,`image       ${active?.imageReady?'ready':active?'working':'—'}`,`image time  ${stats.imageMs===null?'—':Math.round(stats.imageMs)+'ms'}`,`API time    ${stats.providerMs===null?'—':Math.round(stats.providerMs)+'ms'}`,`API calls   ${stats.apiCalls}`,`reveals     ${stats.reveals}`,`eyes        ${stats.eyes}`,`mask        ${stats.mask}`,`renderer    ${renderer.backend}`,`audio       ${muted?'muted':audio.status} · ${stats.sound}`,`last error  ${stats.error}`].join('\n');$('debugEvents').textContent=events.join('\n')}
function cue(text,id){$('ritualText').textContent=text;$('ritualText').hidden=false;log(text);if(!muted)audio.say(id)}
async function sequence(signal){cue('Tule lähemmäksi','come');await delay(comeMs,signal);cue('Katso syvälle silmiisi','look');await delay(lookMs,signal);$('ritualText').hidden=true;log('Sequence finished');updateDebug()}
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
async function foreground(image){
 try{
  if(!segmenterPromise)segmenterPromise=new PersonPresence().load(detector.tf);
  segmenter=await segmenterPromise;const result=await segmenter.detect(image,{force:true});stats.mask=result.present?'snapshot only':'unavailable · vignette';return result.present?result.mask:null;
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
 if(config.provider==='local')result=await dummy(image,face,signal);
 else{
  stats.apiCalls++;
  try{const response=await requestServerImage({imageData:upload(image),model:config.model,effect:'zombie',ratio:image.width/image.height,signal});stats.providerMs=response.providerMs;const edited=new Image();edited.src=response.dataUrl;await edited.decode();result={image:edited,focus:face.center}}
  catch(error){if(signal.aborted)throw error;log(`Image provider failed → dummy backup: ${safeError(error)}`);result=await dummy(image,face,signal)}
 }
 if(debug&&params.has('delay'))await delay(Math.min(30000,Number(params.get('delay'))||0),signal);
 stats.imageMs=performance.now()-started;log(`Image ready · ${Math.round(stats.imageMs)}ms`);return result;
}
async function reveal(result,signal){
 $('ritualText').hidden=true;renderer.show(result.image,revealMs,result.focus);stats.sound=muted?'muted':audio.play();stats.reveals++;mirror.dataset.reveals=String(stats.reveals);log('Reveal');await delay(revealMs,signal);renderer.clearReveal();
}
function trigger(face){
 if(run.state!=='idle'||!source)return;
 const image=snapshot();stats.captures++;stats.error='none';$('tracking').hidden=true;log('Face → capture + sequence + image');
 run.start({generate:signal=>generate(image,face,signal),sequence,reveal});
}
function drawTracking(faces){const c=$('tracking');c.hidden=!debug||!$('boxes').checked;if(c.hidden)return;const r=glass.getBoundingClientRect();c.width=Math.round(r.width);c.height=Math.round(r.height);const t=c.getContext('2d');t.strokeStyle='#9dffb0';t.lineWidth=2;for(const f of faces)t.strokeRect((f.center.x-f.width/2)*c.width,(f.center.y-f.height/2)*c.height,f.width*c.width,f.height*c.height)}
async function loop(now){
 const current=epoch;
 if(source&&run.state==='idle'&&now-lastScan>=300){
  lastScan=now;
  try{if(capture()){
   scan.height=240;scan.width=Math.max(1,Math.round(240*frame.width/frame.height));scanCtx.drawImage(frame,0,0,scan.width,scan.height);
   const faces=await detector.detect(scan);if(current!==epoch)return;lastFace=faces[0]||null;stats.detections++;stats.faces=faces.length;mirror.dataset.faces=String(faces.length);drawTracking(faces);
   if(lastFace)trigger(lastFace);updateDebug();
  }}catch(error){log(`Detection: ${safeError(error)}`)}
 }
 if(current===epoch&&source)raf=requestAnimationFrame(loop);
}
function stop(){epoch++;cancelAnimationFrame(raf);run.reset();renderer.stop();renderer.clearReveal();audio.stop();$('ritualText').hidden=true;stream?.getTracks().forEach(track=>track.stop());stream=null;source=null;video.srcObject=null;starting=false}
async function start(){
 if(starting||source)return;starting=true;const current=++epoch;$('startup').hidden=false;$('enable').hidden=true;$('message').textContent='Opening the mirror…';
 try{
  const ready=Promise.all([loadDetector(),fetch('/api/mirror/config').then(r=>r.json()).then(c=>{configured=!!c.configured;$('serverKeyStatus').textContent=configured?'Server configured · dummy is the default':'Dummy mode · no API needed'}).catch(()=>{})]);
  if(fixture){const image=fixture==='portrait'?new Image():document.createElement('canvas');if(fixture==='portrait'){image.src='portrait.jpg';await image.decode()}else{image.width=600;image.height=800;image.getContext('2d').fillRect(0,0,600,800)}if(current!==epoch)return;source=image;video.hidden=true}
  else{const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});if(current!==epoch){camera.getTracks().forEach(t=>t.stop());return}stream=camera;video.srcObject=camera;await video.play();source=video}
  await ready;if(current!==epoch)return;$('startup').hidden=true;mirror.dataset.ready='true';mirror.dataset.phase='live';renderer.start(source);lastScan=-Infinity;raf=requestAnimationFrame(loop);log('Mirror ready · dummy default');
 }catch(error){if(current!==epoch)return;stop();$('startup').hidden=false;$('message').textContent=`Camera/detector: ${safeError(error)}`;$('enable').hidden=false}
 finally{if(current===epoch)starting=false}
}
async function unlock(){if(muted)return;try{await audio.unlock();$('armAudio').hidden=audio.status==='running'}catch(error){log(safeError(error))}}
$('armAudio').hidden=muted;$('armAudio').addEventListener('click',unlock);window.addEventListener('pointerdown',()=>{if(audio.status!=='running')void unlock()},{passive:true});
$('enable').addEventListener('click',()=>{stop();start()});$('retry').addEventListener('click',()=>{$('runError').hidden=true;run.reset()});
if(debug){
 $('debug').hidden=false;$('apiModel').value=DEFAULT_MODEL;
 $('providerForm').addEventListener('submit',e=>{e.preventDefault();if(run.state!=='idle'){log('Finish the current run before changing provider');return}if(!configured){log('Server provider unavailable');return}config.provider='server';config.model=$('apiModel').value||DEFAULT_MODEL;$('providerStatus').textContent=`Remote · ${config.model}`;updateDebug()});
 $('useLocal').addEventListener('click',()=>{if(run.state!=='idle')return;config.provider='local';$('providerStatus').textContent='Dummy · no API calls';updateDebug()});
 $('morph').addEventListener('input',e=>{config.morph=Number(e.target.value)/100;renderer.strength=$('boxes').checked?0:config.morph});
 $('volume').addEventListener('input',e=>audio.setVolume(Number(e.target.value)/100));
 $('boxes').addEventListener('change',()=>{renderer.strength=$('boxes').checked?0:config.morph;if(!$('boxes').checked)$('tracking').hidden=true});renderer.strength=0;
 $('testSound').addEventListener('click',async()=>{await unlock();stats.sound=audio.play();updateDebug()});
 $('testScare').addEventListener('click',()=>{if(run.state==='idle'&&lastFace&&capture())trigger(lastFace)});
 $('providerStatus').textContent='Dummy · no API calls';setInterval(updateDebug,250);
}
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
// Resize only changes drawing dimensions. It never cancels a run.
start();
