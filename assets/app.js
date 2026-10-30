import {transformSnapshot} from './effects.js';
import {MirrorCycle} from './cycle.js';
import {HorrorAudio} from './audio.js';
import {DEFAULT_MODEL,requestServerImage,safeError} from './provider.js';
const $=id=>document.getElementById(id);
const mirror=$('mirror'),glass=$('glass'),video=$('camera'),reflection=$('reflection');
const params=new URLSearchParams(location.search),fixture=params.get('test'),debug=params.has('debug')&&params.get('debug')!=='0',muted=params.get('mute')==='1';
const effect=['zombie','ghost','aged'].includes(params.get('effect'))?params.get('effect'):'zombie';
let stream=null,detector=null,detectorPromise=null,source=null,raf=null,lastScan=-Infinity,lastVideoTime=-1,generation=0,wakeLock=null,fixtureImage=null,opening=false,activeRequest=null,lastFace=null;
const frame=document.createElement('canvas'),scan=document.createElement('canvas');
const frameContext=frame.getContext('2d',{alpha:false}),scanContext=scan.getContext('2d',{alpha:false});
const cycle=new MirrorCycle(),audio=new HorrorAudio(),events=[];
const stats={detector:'loading',scans:0,faces:0,confidence:0,inferenceMs:0,renderMs:null,firstFaceAt:null,reveals:0,apiCalls:0,apiCost:0,costKnown:false,lastSound:'none',error:'none',lastTrigger:'none'};
let serverConfigured=false;
let config={provider:'auto',model:DEFAULT_MODEL,sound:'random',volume:.65};
try{const saved=JSON.parse(sessionStorage.getItem('mirror-controls')||'{}');for(const key of Object.keys(config))if(saved[key]!==undefined)config[key]=saved[key]}catch{}
audio.setVolume(Number(config.volume)||0);
function saveConfig(){try{sessionStorage.setItem('mirror-controls',JSON.stringify(config))}catch{}}
function log(text){const safe=safeError(text);events.unshift(`${new Date().toLocaleTimeString()} ${safe}`);events.length=Math.min(events.length,12);updateDebug()}
function phase(p){mirror.dataset.phase=p;updateDebug()}
function notify(text,canRetry=false){mirror.dataset.ready='false';$('message').textContent=text;$('enable').hidden=!canRetry;$('startup').hidden=false}
function updateAudioPrompt(){$('armAudio').hidden=muted||audio.status==='running';}
async function unlockAudio(){if(muted)return;try{const ready=await audio.unlock();if(ready)updateAudioPrompt()}catch(error){log(`Audio: ${safeError(error)}`)}updateDebug()}
window.addEventListener('pointerdown',()=>{if(audio.status!=='running')void unlockAudio()},{passive:true});
window.addEventListener('keydown',()=>{if(audio.status!=='running')void unlockAudio()});
$('armAudio').addEventListener('click',unlockAudio);updateAudioPrompt();
function abortRequest(reason){if(activeRequest){activeRequest.controller.abort();activeRequest=null;mirror.dataset.requesting='false';log(reason)}}
async function loadDetector(){
 if(detector)return detector;
 if(!detectorPromise)detectorPromise=(async()=>{
  await import('./vendor/face-api.min.js');const api=globalThis.faceapi;
  let backend='cpu';
  if(params.get('backend')!=='cpu'){
   const probe=document.createElement('canvas');let gl=null;
   try{gl=probe.getContext('webgl2')||probe.getContext('webgl');if(gl){await api.tf.setBackend('webgl');backend=api.tf.getBackend()==='webgl'?'webgl':'cpu'}}catch{}
   try{gl?.getExtension('WEBGL_lose_context')?.loseContext()}catch{}
  }
  if(backend==='cpu')await api.tf.setBackend('cpu');
  await Promise.all([api.nets.tinyFaceDetector.loadFromUri('./models'),api.nets.faceLandmark68TinyNet.loadFromUri('./models')]);
  stats.detector=`ready · ${backend.toUpperCase()}`;log(`Face detector ready · ${backend}`);
  return {async detect(input){
   const results=await api.detectAllFaces(input,new api.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.62})).withFaceLandmarks(true);
   return results.map(d=>{const box=d.detection.box;const eye=points=>({x:points.reduce((n,p)=>n+p.x,0)/points.length/input.width,y:points.reduce((n,p)=>n+p.y,0)/points.length/input.height});return {eyes:[eye(d.landmarks.getLeftEye()),eye(d.landmarks.getRightEye())],center:{x:(box.x+box.width/2)/input.width,y:(box.y+box.height/2)/input.height},width:box.width/input.width,height:box.height/input.height,score:d.detection.score}});
  }};
 })().catch(error=>{stats.detector='failed';detectorPromise=null;throw error});
 detector=await detectorPromise;return detector;
}
function stop(){generation++;cancelAnimationFrame(raf);raf=null;abortRequest('Request cancelled: mirror paused');cycle.reset();phase('live');audio.stop();if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;source=null;opening=false;lastFace=null;if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
function dimensions(){const rect=glass.getBoundingClientRect();const ratio=Math.max(.25,rect.width/Math.max(1,rect.height));const height=Math.min(1200,Math.round(900/ratio)),width=Math.round(height*ratio);if(frame.width!==width||frame.height!==height){frame.width=width;frame.height=height}const sh=240,sw=Math.max(1,Math.round(sh*ratio));if(scan.width!==sw||scan.height!==sh){scan.width=sw;scan.height=sh}}
function drawFrame(){
 dimensions();const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;
 if(!sw||!sh)return false;const scale=Math.max(frame.width/sw,frame.height/sh),w=sw*scale,h=sh*scale;
 frameContext.save();frameContext.fillStyle='#10120f';frameContext.fillRect(0,0,frame.width,frame.height);frameContext.translate(frame.width,0);frameContext.scale(-1,1);frameContext.drawImage(source,(frame.width-w)/2,(frame.height-h)/2,w,h);frameContext.restore();return true;
}
function drawFixture(){if(!fixtureImage)return;const r=glass.getBoundingClientRect();reflection.width=Math.max(1,Math.round(r.width));reflection.height=Math.max(1,Math.round(r.height));const ctx=reflection.getContext('2d'),scale=Math.max(reflection.width/fixtureImage.width,reflection.height/fixtureImage.height);ctx.save();ctx.translate(reflection.width,0);ctx.scale(-1,1);ctx.drawImage(fixtureImage,(reflection.width-fixtureImage.width*scale)/2,(reflection.height-fixtureImage.height*scale)/2,fixtureImage.width*scale,fixtureImage.height*scale);ctx.restore();reflection.style.opacity='1'}
function drawTracking(faces){
 if(!debug)return;const c=$('tracking');c.hidden=!$('boxes').checked;if(c.hidden)return;const r=glass.getBoundingClientRect();c.width=Math.round(r.width);c.height=Math.round(r.height);const ctx=c.getContext('2d');ctx.strokeStyle='#9dffb0';ctx.lineWidth=2;ctx.font='12px monospace';ctx.fillStyle='#aaffba';
 for(const f of faces){const x=(f.center.x-f.width/2)*c.width,y=(f.center.y-f.height/2)*c.height;ctx.strokeRect(x,y,f.width*c.width,f.height*c.height);ctx.fillText(`${Math.round(f.score*100)}%`,x+4,Math.max(16,y-7));for(const eye of f.eyes){ctx.beginPath();ctx.arc(eye.x*c.width,eye.y*c.height,4,0,Math.PI*2);ctx.fill()}}
}
async function reveal(face,ticket,run){
 if(activeRequest){cycle.fail(ticket,performance.now());return}
 const snapshot=document.createElement('canvas');snapshot.width=frame.width;snapshot.height=frame.height;snapshot.getContext('2d').drawImage(frame,0,0);
 const request={ticket,run,controller:new AbortController(),started:performance.now(),provider:config.provider};activeRequest=request;mirror.dataset.requesting='true';stats.lastTrigger='first available detection';stats.error='none';log(`Capture → ${config.provider==='local'?'dummy effect':config.model}`);
 const timeout=setTimeout(()=>request.controller.abort('timeout'),90000);
 try{
  let edited;
  if(request.provider==='server'){
   stats.apiCalls++;
   const response=await requestServerImage({imageData:snapshot.toDataURL('image/jpeg',.86),model:config.model,effect,ratio:snapshot.width/snapshot.height,signal:request.controller.signal});
   if(response.cost!==null){stats.apiCost+=response.cost;stats.costKnown=true}
   edited=new Image();edited.src=response.dataUrl;await edited.decode();
  }else{edited=await transformSnapshot({image:snapshot,face,effect})}
  if(request.controller.signal.aborted||run!==generation||!cycle.complete(ticket,performance.now())){cycle.fail(ticket,performance.now());if(run===generation&&ticket===cycle.ticket)phase(cycle.phase);log('Result discarded: visitor left or request changed');return}
  stats.renderMs=performance.now()-request.started;reflection.width=edited.naturalWidth||edited.width;reflection.height=edited.naturalHeight||edited.height;reflection.getContext('2d').drawImage(edited,0,0);
  mirror.classList.remove('impact');void mirror.offsetWidth;phase('reveal');mirror.classList.add('impact');
  stats.lastSound=muted?'muted':audio.play(config.sound);stats.reveals++;mirror.dataset.reveals=String(stats.reveals);log(`Scare shown · ${Math.round(stats.renderMs)}ms · ${stats.lastSound}`);updateAudioPrompt();
 }catch(error){
  if(run!==generation||ticket!==cycle.ticket)return;
  cycle.fail(ticket,performance.now());phase('live');
  if(request.controller.signal.aborted){stats.error=request.controller.signal.reason==='timeout'?'Image request timed out':'Request cancelled'}else{stats.error=safeError(error);if(/OpenRouter (400|401|402|403|404):/.test(stats.error))cycle.nextCapture=Infinity}
  log(stats.error);
 }finally{clearTimeout(timeout);if(activeRequest===request){activeRequest=null;mirror.dataset.requesting='false'}updateDebug()}
}
async function loop(now){
 const run=generation;if(!source||document.hidden)return;
 if(now-lastScan>=300&&(fixture||video.currentTime!==lastVideoTime)){
  lastScan=now;lastVideoTime=video.currentTime;
  try{if(drawFrame()){
   scanContext.drawImage(frame,0,0,scan.width,scan.height);const detectionStarted=performance.now();
   const detected=(await detector.detect(scan)).filter(f=>f.width>.1&&f.height>.08).sort((a,b)=>b.width*b.height-a.width*a.height);
   if(run!==generation)return;
   const observedAt=performance.now();lastScan=observedAt;stats.inferenceMs=observedAt-detectionStarted;stats.scans++;stats.faces=detected.length;stats.confidence=detected[0]?.score||0;lastFace=detected[0]||null;
   if(lastFace&&stats.firstFaceAt===null)stats.firstFaceAt=observedAt;
   mirror.dataset.faces=String(detected.length);const action=cycle.observe(lastFace,observedAt);mirror.dataset.detections=String(stats.scans);drawTracking(detected);
   if(action.hide){abortRequest('Request cancelled: face left or changed');phase('live');mirror.classList.remove('impact');if(fixture)drawFixture()}
   if(action.capture){phase('processing');void reveal(lastFace,action.ticket,run)}
   updateDebug();
  }}catch(error){console.error('Face detection failed',safeError(error));stats.error=safeError(error);stop();phase('error');notify('Face detection could not start. Tap to try again.',true);log(stats.error);return}
 }
 raf=requestAnimationFrame(loop);
}
async function start(){
 if(opening||stream)return;opening=true;const run=++generation;$('enable').hidden=true;notify('Opening the mirror…');phase('starting');
 try{
  const model=Promise.all([loadDetector(),loadServerConfig()]);model.catch(()=>{});
  if(fixture){
   video.hidden=true;
   if(fixture==='portrait'){fixtureImage=new Image();fixtureImage.src='portrait.jpg';await fixtureImage.decode();source=fixtureImage}
   else{const blank=document.createElement('canvas');blank.width=600;blank.height=800;blank.getContext('2d').fillRect(0,0,600,800);source=blank;fixtureImage=blank}
   await model;if(run!==generation)return;drawFixture();
  }else{
   if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('camera unavailable'),{name:'NotSupportedError'});
   const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});
   if(run!==generation){camera.getTracks().forEach(t=>t.stop());return}stream=camera;video.srcObject=camera;
   await video.play();source=video;notify('The mirror is waking up…');await model;if(run!==generation)return;
   try{wakeLock=await navigator.wakeLock?.request('screen')}catch{}
  }
  mirror.dataset.ready='true';phase('live');cycle.reset();stats.firstFaceAt=null;lastScan=-Infinity;lastVideoTime=-1;raf=requestAnimationFrame(loop);updateAudioPrompt();log('Mirror running');
 }catch(error){if(run!==generation)return;stats.error=safeError(error);console.error('Mirror startup failed',stats.error);stop();phase('error');
  const permission=['NotAllowedError','SecurityError'].includes(error.name),missing=['NotFoundError','NotSupportedError'].includes(error.name);
  notify(permission?'Allow the camera to open the mirror.':missing?'No camera is available. Connect one, then try again.':'The mirror could not start. Tap to try again.',true);log(stats.error);
 }finally{if(run===generation)opening=false}
}
function updateDebug(){
 if(!debug)return;
 const running=activeRequest?`${Math.round(performance.now()-activeRequest.started)}ms`:'—';
 const resolution=source?`${source.videoWidth||source.width}×${source.videoHeight||source.height}`:'not open';
 $('debugState').textContent=[`phase       ${mirror.dataset.phase}`,`source      ${fixture||'camera'} · ${resolution}`,`detector    ${stats.detector}`,`faces       ${stats.faces} · ${Math.round(stats.confidence*100)}%`,`scan        ${stats.scans} · ${Math.round(stats.inferenceMs)}ms`,`provider    ${config.provider==='local'?'dummy':config.model}`,`key         ${serverConfigured?'configured on server':'not configured'}`,`request     ${running}`,`last render ${stats.renderMs===null?'—':Math.round(stats.renderMs)+'ms'}`,`reveals     ${stats.reveals} · first detection triggers now`,`audio       ${muted?'muted by query':audio.status} · ${stats.lastSound}`,`API calls   ${stats.apiCalls} · cost ${stats.costKnown?'$'+stats.apiCost.toFixed(4):'not reported'}`,`last error  ${stats.error}`].join('\n');
 $('debugEvents').textContent=events.join('\n');
}
async function loadServerConfig(){
 try{const response=await fetch('/api/mirror/config',{cache:'no-store'});if(!response.ok)throw new Error('Server configuration unavailable');const data=await response.json();serverConfigured=!!data.configured;if(config.provider==='auto')config.provider=serverConfigured?'server':'local';if(!serverConfigured&&config.provider==='server')config.provider='local';if(config.model===DEFAULT_MODEL&&data.model)config.model=data.model;if(debug){$('serverKeyStatus').textContent=serverConfigured?'Server key configured · no key entry needed':'No server key configured in this preview.';$('apiModel').value=config.model;$('providerStatus').textContent=config.provider==='server'?`Using ${config.model}.`:'Using the local dummy effect.'}log(serverConfigured?'Server image provider ready':'Local preview · dummy provider')}
 catch(error){if(config.provider==='auto')config.provider='local';log(safeError(error))}
}
function resetProvider(){abortRequest('Provider changed');cycle.reset();phase('live');if(fixture)drawFixture();stats.error='none';$('providerStatus').textContent=config.provider==='server'?`Using ${config.model}. Face snapshots are sent automatically.`:'Using the local dummy effect.';saveConfig();updateDebug()}

if(debug){
 $('debug').hidden=false;$('apiModel').value=config.model;$('sound').value=config.sound;$('volume').value=Math.round(config.volume*100);
 $('providerStatus').textContent=config.provider==='server'?`Using ${config.model}.`:'No image model connected · local dummy.';
 $('providerForm').addEventListener('submit',event=>{event.preventDefault();if(!serverConfigured){$('providerStatus').textContent='The server key is not configured.';return}config.model=$('apiModel').value.trim()||DEFAULT_MODEL;config.provider='server';resetProvider();log('Server image model enabled')});
 $('useLocal').addEventListener('click',()=>{config.provider='local';resetProvider();log('Local dummy enabled')});
 $('sound').addEventListener('change',event=>{config.sound=event.target.value;saveConfig()});$('volume').addEventListener('input',event=>{config.volume=Number(event.target.value)/100;audio.setVolume(config.volume);saveConfig()});
 $('boxes').addEventListener('change',()=>{if(!$('boxes').checked)$('tracking').hidden=true});
 $('testSound').addEventListener('click',async()=>{await unlockAudio();stats.lastSound=muted?'muted':audio.play(config.sound);log(`Sound test: ${stats.lastSound}`)});
 $('testScare').addEventListener('click',()=>{if(!lastFace||!source){log('No face detected yet');return}abortRequest('Manual debug reveal');cycle.reset();if(drawFrame()){const action=cycle.observe(lastFace,performance.now());phase('processing');void reveal(lastFace,action.ticket,generation)}});
 setInterval(updateDebug,300);
}
$('enable').addEventListener('click',()=>{void unlockAudio();stop();start()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{start();updateAudioPrompt()}});
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',event=>{if(event.persisted)start()});
window.addEventListener('resize',()=>{abortRequest('Viewport changed');cycle.reset();phase('live');if(fixture)drawFixture()});
start();
