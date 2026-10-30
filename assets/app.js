import {transformSnapshot} from './effects.js';
import {FaceTracker,faceToMirror,bothEyesVisible,facingMirror} from './tracker.js';
import {MirrorRenderer} from './renderer.js';
import {MirrorRun,delay} from './run.js';
import {loadSettings,saveSettings,ENDINGS} from './settings.js';
import {ScreenWakeLock} from './wake-lock.js';
import {enterFullscreen} from './fullscreen.js';
import {layoutLights,approachBlinks} from './lights.js';
import {HorrorAudio} from './audio.js';
import {SCREAMS} from './screams.js';
import {safeError} from './provider.js';
const $=id=>document.getElementById(id),mirror=$('mirror'),video=$('camera'),glass=$('glass');
const params=new URLSearchParams(location.search),debug=params.has('debug'),fixture=params.get('test'),muted=params.get('mute')==='1';
const revealMs=650,encoreMs=450,lookMs=4000,startDelayMs=2000,laughDelayMs=400;
let trackedFaces=[],activeCue=null,liveEyeFocus=null,liveEyes=null,moveFixture=null,scareEndsAt=0,approachPulse=null;
let source=null,stream=null,detector=null,raf=0,epoch=0,starting=false,lastScan=-Infinity,lastFace=null;
let config=loadSettings();
const stats={detections:0,faces:0,captures:0,reveals:0,apiCalls:0,providerMs:null,imageMs:null,frameAgeMs:null,error:'none',sound:'locked',eyes:'not measured'};
const lightFrame=$('lights');new ResizeObserver(()=>layoutLights(lightFrame)).observe(lightFrame);
const events=[],audio=new HorrorAudio();audio.setVolume(config.volume);
const wakeLock=new ScreenWakeLock(navigator,document,()=>updateDebug());
const frame=document.createElement('canvas'),scan=document.createElement('canvas');
const ctx=frame.getContext('2d',{alpha:false}),scanCtx=scan.getContext('2d',{alpha:false});
const renderer=new MirrorRenderer($('atmosphere'),{revealCanvas:$('reflection'),onTick:()=>drawTracking(trackedFaces),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
renderer.strength=config.morph;
const run=new MirrorRun(state=>{
 if(state!=='approach'){approachPulse?.cancel();approachPulse=null}
 mirror.dataset.phase=state==='running'?'processing':state==='reveal'?'reveal':'live';
 mirror.dataset.requesting=String(state==='running');
 if(state!=='instruction')audio.stop('instruction');
 if(state==='finished')log('Waiting for 1s without a face');
 if(state==='idle'||state==='finished'){activeCue=null;$('ritualText').hidden=true;audio.stop('whisper')}
 if(state==='error'){stats.error=safeError(run.error);$('errorText').textContent=stats.error;$('runError').hidden=false;log(stats.error)}
 updateDebug();
});
function log(message){events.unshift(`${new Date().toLocaleTimeString()} ${safeError(message)}`);events.length=Math.min(10,events.length);updateDebug()}
function headFacing(){const rect=glass.getBoundingClientRect();return facingMirror(lastFace,rect.width/Math.max(1,rect.height))}
function updateDebug(){if(!debug)return;const active=run.active;$('debugState').textContent=[`state       ${run.state} · ${run.armed?'armed':'needs 1s absence'}`,'provider    dummy (no API calls)',`face scans  ${stats.detections} · ${stats.faces} faces`,`distance    ${lastFace?Math.round(lastFace.width*100)+'% face width':'no face'} · close at ${Math.round(config.closeWidth*100)}%`,`eyes in view ${bothEyesVisible(lastFace,eye=>renderer.projectPoint(eye))?'both':'no'}`,`head facing ${headFacing()?'yes':'no'}`,`capture     ${stats.captures}`,`sequence    ${active?.sequenceDone?'finished':active?'running':'—'}`,`image       ${active?.imageReady?'ready':active?.generateAfterSequence&&!active.sequenceDone?'waiting for final capture':active?'working':'—'}`,`image time  ${stats.imageMs===null?'—':Math.round(stats.imageMs)+'ms'}`,`frame age   ${stats.frameAgeMs===null?'—':Math.round(stats.frameAgeMs)+'ms at reveal'}`,`API time    ${stats.providerMs===null?'—':Math.round(stats.providerMs)+'ms'}`,`API calls   ${stats.apiCalls}`,`reveals     ${stats.reveals}`,`eyes        ${stats.eyes}`,`tracking    ${stats.trackerMs===undefined?'—':Math.round(stats.trackerMs)+'ms · worker'}`,`eye age     ${stats.eyeSampleAt===undefined?'—':Math.round(performance.now()-stats.eyeSampleAt)+'ms'}`,`renderer    ${renderer.backend}`,`audio       ${muted?'muted':audio.status} · ${stats.sound}`,`wake lock   ${wakeLock.status}`,`last error  ${stats.error}`].join('\n');$('debugEvents').textContent=events.join('\n')}
function playActiveCue(){
 if(muted||!activeCue||activeCue.played||performance.now()>=activeCue.until)return;
 const result=audio.say(activeCue.id);stats.sound=`whisper ${activeCue.id}: ${result}`;
 if(result===activeCue.id){activeCue.played=true;log(`Whisper played: ${activeCue.id}`)}
 updateAudioPrompt();updateDebug();
}
function cue(text,id,duration){
 activeCue={id,played:false,until:performance.now()+duration};$('ritualText').textContent=text;$('ritualText').hidden=!config.texts;
 if(id==='opening'||id==='come'||id==='here'){
  approachPulse?.cancel();
  const flashes=renderer.reduced?[{opacity:1},{opacity:.85,offset:.45},{opacity:1}]:approachBlinks(duration);
  approachPulse=lightFrame.animate(flashes,{duration,easing:renderer.reduced?'ease-in-out':'linear'});
 }
 log(text);playActiveCue();
}
async function approach(signal){
 log('Approach · 2s lead-in');await delay(startDelayMs,signal);
 const prompts=[['opening','Psst. Täällä peilissä. Katso.'],['come','Tule lähemmäksi.'],['here','Katso tänne.']];
 let speakingUntil=0,nextPromptAt=0,introduced=false,promptIndex=0;
 while(true){
  const now=performance.now(),near=run.facePresent&&lastFace?.width>=config.closeWidth,close=near&&bothEyesVisible(lastFace,eye=>renderer.projectPoint(eye))&&headFacing();
  if(close&&introduced&&now>=speakingUntil)break;
  if((!close||!introduced)&&run.facePresent&&now>=nextPromptAt){
   if(near&&promptIndex===1)promptIndex=2;
   const [id,text]=prompts[promptIndex],duration=Math.ceil(audio.duration(id,3)*1000);cue(text,id,duration);
   if(id==='opening')introduced=true;promptIndex=(promptIndex+1)%prompts.length;
   speakingUntil=now+duration;nextPromptAt=speakingUntil+1200;
  }
  await delay(100,signal);
 }
 activeCue=null;$('ritualText').hidden=true;audio.stop('whisper');log('Close enough → secret');
}
async function sequence(signal){
 const secretMs=Math.ceil(audio.duration('secret',6)*1000)+650;
 cue('Näytän sinulle salaisuuden, älä kerro tästä kellekään.','secret',secretMs);await delay(secretMs,signal);
 cue('Katso syvälle silmiisi.','look',lookMs);await delay(lookMs,signal);
 activeCue=null;$('ritualText').hidden=true;log('Sequence finished');updateDebug();
}
async function loadDetector(){
 if(!detector)detector=new FaceTracker(data=>{
  if(data.epoch!==epoch||!source||run.state==='reveal')return;
  const rect=glass.getBoundingClientRect(),faces=data.faces.map(face=>faceToMirror(face,data.width/data.height,rect.width/rect.height));
  updateLiveEyes(faces);trackedFaces=faces;lastFace=faces[0]||null;stats.detections++;stats.faces=faces.length;stats.trackerMs=data.inferenceMs;stats.eyeSampleAt=data.sampledAt;mirror.dataset.faces=String(faces.length);
  run.observeFace(!!lastFace,performance.now());if(lastFace)trigger(lastFace);drawTracking(faces);updateDebug();
 },error=>log(`Tracking: ${safeError(error)}`));
 try{await detector.ready}catch(error){detector.worker.terminate();detector=null;throw error}log('Face tracker ready · '+detector.backend);
}
function capture(){
 const rect=glass.getBoundingClientRect(),ratio=rect.width/Math.max(1,rect.height);frame.height=Math.min(960,Math.round(720/ratio));frame.width=Math.round(frame.height*ratio);
 const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
 if(!width||!height)return false;
 const scale=Math.max(frame.width/width,frame.height/height);ctx.save();ctx.translate(frame.width,0);ctx.scale(-1,1);ctx.drawImage(source,(frame.width-width*scale)/2,(frame.height-height*scale)/2,width*scale,height*scale);ctx.restore();return true;
}
function latestDummy(face,signal){
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 moveFixture?.(performance.now());
 if(!capture())throw new Error('Camera frame unavailable');
 const capturedAt=performance.now(),aligned=lastFace||face;stats.captures++;
 const eyes=liveEyes||aligned.eyes||[{x:aligned.center.x-aligned.width*.18,y:aligned.center.y-aligned.height*.08},{x:aligned.center.x+aligned.width*.18,y:aligned.center.y-aligned.height*.08}];
 const image=transformSnapshot({image:frame,face:{...aligned,eyes}}),focus={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2};
 stats.eyes='latest tracker eyes';log('Late dummy capture · canvas only');return {image,focus,capturedAt};
}
async function generate(face,signal){
 const started=performance.now();stats.imageMs=null;
 const result=latestDummy(face,signal);
 if(debug&&params.has('delay'))await delay(Math.min(30000,Number(params.get('delay'))||0),signal);
 stats.imageMs=performance.now()-started;log(`Image ready · ${Math.round(stats.imageMs)}ms`);return result;
}
function updateLiveEyes(faces){
 const eyes=faces[0]?.eyes;if(eyes?.length===2){liveEyes=eyes;liveEyeFocus={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2}}
}
function beforeReveal(result){
 const eyes=liveEyes||[result.focus],displayEyes=eyes.map(eye=>renderer.projectPoint(eye)),target={x:displayEyes.reduce((s,p)=>s+p.x,0)/displayEyes.length,y:displayEyes.reduce((s,p)=>s+p.y,0)/displayEyes.length};
 return {...result,target};
}
async function reveal(result,signal){
 stats.frameAgeMs=result.capturedAt===undefined?null:performance.now()-result.capturedAt;
 await showStartle(result,signal,revealMs);
}
async function showStartle(result,signal,duration,repeated=false){
 const soundLimit=duration<revealMs?duration/1000:undefined;
 $('ritualText').hidden=true;renderer.show(result.image,duration,result.focus,result.target);stats.sound=muted?'muted':audio.play(soundLimit,config.scream);scareEndsAt=performance.now()+Math.min(soundLimit??Infinity,audio.duration(config.scream,.72))*1000;stats.reveals++;mirror.dataset.reveals=String(stats.reveals);log((repeated?'Cached second scare':'Reveal')+' · '+config.scream);await delay(duration,signal);renderer.clearReveal();
 if(repeated)await delay(Math.max(0,scareEndsAt-performance.now()),signal);
}
async function instruction(signal){
 stats.sound=muted?'muted':audio.warning(config.ending);log('Post-sequence instruction · '+config.ending+' · '+stats.sound);
 // Once the scare starts, the laugh and ending finish even if the viewer leaves.
 await delay(audio.duration(config.ending==='secret'?'warningPrivate':'warning',12)*1000,signal);
}
async function afterReveal(signal){
 await delay(Math.max(laughDelayMs,scareEndsAt-performance.now()),signal);stats.sound=muted?'muted':audio.laugh();log('Nelson laugh');
 await delay(audio.duration('laugh',1)*1000,signal);
}
function trigger(face){
 if(run.state!=='idle'||!run.armed||!source)return;
 stats.error='none';stats.frameAgeMs=null;stats.imageMs=null;stats.providerMs=null;
 log('Face → approach → sequence');
 run.start({approach,generate:signal=>generate(lastFace||face,signal),generateAfterSequence:true,sequence,beforeReveal,reveal,afterReveal,instruction,encore:config.encore!=='off'?(result,signal)=>showStartle(result,signal,config.encore==='original'?revealMs:encoreMs,true):null});
}
function drawTracking(faces){
 const c=$('tracking');c.hidden=!debug||!config.boxes||run.state==='reveal';if(c.hidden)return;
 const r=glass.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);if(c.width!==w||c.height!==h){c.width=w;c.height=h}
 const t=c.getContext('2d');t.clearRect(0,0,w,h);
 function outline(center,width,height){
  const left=center.x-width/2,top=center.y-height/2,corners=[{x:left,y:top},{x:left+width,y:top},{x:left+width,y:top+height},{x:left,y:top+height}];
  t.beginPath();for(let side=0;side<4;side++)for(let i=0;i<8;i++){const a=corners[side],b=corners[(side+1)%4],p=renderer.projectPoint({x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8});if(!side&&!i)t.moveTo(p.x*w,p.y*h);else t.lineTo(p.x*w,p.y*h)}t.closePath();t.stroke();
 }
 // Dashed amber = required width. Its height is only a visual guide.
 const face=faces[0],center=face?.center||{x:.5,y:.5},guideHeight=face?face.height*config.closeWidth/face.width:config.closeWidth*w/h*1.3;
 t.strokeStyle='#ffc36a';t.lineWidth=1.5;t.setLineDash([7,5]);outline(center,config.closeWidth,guideHeight);t.setLineDash([]);
 const label=renderer.projectPoint({x:center.x-config.closeWidth/2,y:center.y-guideHeight/2});
 t.font='12px system-ui';t.fillStyle='#ffc36a';t.fillText(`Close: ${Math.round(config.closeWidth*100)}% of view width`,Math.max(8,Math.min(w-190,label.x*w)),Math.max(18,label.y*h-8));
 t.strokeStyle='#9dffb0';t.lineWidth=2;
 for(const f of faces){
  outline(f.center,f.width,f.height);
  if(f.eyes?.length===2){t.strokeStyle='#ffdf65';t.fillStyle='#ffdf65';for(const eye of f.eyes){const p=renderer.projectPoint(eye),x=p.x*w,y=p.y*h;t.beginPath();t.arc(x,y,4,0,Math.PI*2);t.stroke();t.beginPath();t.moveTo(x-9,y);t.lineTo(x+9,y);t.moveTo(x,y-9);t.lineTo(x,y+9);t.stroke()}t.strokeStyle='#9dffb0'}
 }
}

function loop(now){
 moveFixture?.(now);
 if(source&&run.state!=='reveal'&&now-lastScan>=100&&!detector.busy){
  lastScan=now;
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(width&&height){const scale=Math.min(1,384/Math.max(width,height));scan.width=Math.round(width*scale);scan.height=Math.round(height*scale);scanCtx.drawImage(source,0,0,scan.width,scan.height);void detector.submit(scan,now,epoch)}
 }
 if(source)raf=requestAnimationFrame(loop);
}
function stop(){void wakeLock.release();moveFixture=null;liveEyeFocus=null;liveEyes=null;activeCue=null;trackedFaces=[];epoch++;cancelAnimationFrame(raf);run.reset();renderer.stop();renderer.clearReveal();audio.stop();$('ritualText').hidden=true;stream?.getTracks().forEach(track=>track.stop());stream=null;source=null;video.srcObject=null;starting=false}
async function start(){
 if(starting||source)return;starting=true;void wakeLock.acquire();const current=++epoch;$('startup').hidden=false;$('enable').hidden=true;$('message').textContent='Opening the mirror…';
 try{
  const ready=Promise.all([audio.prepare().catch(error=>log(safeError(error))),loadDetector()]);
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
async function unlock(fullscreen=false){
 $('startMirror').disabled=true;
 try{
  const unlocked=audio.unlock();
  // Both browser APIs are called within the original user gesture.
  if(fullscreen)void enterFullscreen().then(entered=>{if(debug)log(entered?'Fullscreen entered':'Fullscreen unavailable or declined')});
  if(!await unlocked)throw new Error('Audio is still locked');updateAudioPrompt();
 }
 catch(error){$('audioGateMessage').textContent=safeError(error)}
 finally{$('startMirror').disabled=false}
}
$('startMirror').addEventListener('click',()=>unlock(true));
$('enable').addEventListener('click',()=>{stop();updateAudioPrompt()});$('retry').addEventListener('click',()=>{$('runError').hidden=true;run.reset()});
function showCloseWidth(){
 const percent=Math.round(config.closeWidth*100);$('closeWidthValue').textContent=percent+'%';$('closeWidth').setAttribute('aria-valuetext',percent+'% of mirror width');
}
function persistSettings(){
 const saved=saveSettings(config);$('settingsStatus').textContent=saved?'Saved automatically in this browser.':'Browser storage unavailable; changes last until reload.';
}
if(debug){
 for(const [id,sound] of Object.entries(SCREAMS)){const option=document.createElement('option');option.value=id;option.textContent=sound.label;$('scream').append(option)}
 $('scream').value=config.scream;
 $('scream').addEventListener('change',e=>{config.scream=e.target.value;persistSettings()});
 for(const [id,key] of [['volume','volume'],['morph','morph'],['closeWidth','closeWidth']])$(id).value=Math.round(config[key]*100);
 showCloseWidth();
 $('showTexts').checked=config.texts;$('boxes').checked=config.boxes;$('ending').value=config.ending;$('endingCopy').textContent=ENDINGS[config.ending];
 $('encore').value=config.encore;
 $('encore').addEventListener('change',e=>{config.encore=e.target.value;persistSettings()});
 $('ending').addEventListener('change',e=>{config.ending=e.target.value;$('endingCopy').textContent=ENDINGS[config.ending];persistSettings()});
 $('testEnding').addEventListener('click',async()=>{await unlock();stats.sound=audio.warning(config.ending);updateDebug()});
 $('debug').hidden=audio.status!=='running';
 $('closeWidth').addEventListener('input',e=>{config.closeWidth=Number(e.target.value)/100;showCloseWidth();persistSettings();drawTracking(trackedFaces);updateDebug()});
 $('morph').addEventListener('input',e=>{config.morph=Number(e.target.value)/100;renderer.strength=config.morph;persistSettings()});
 $('volume').addEventListener('input',e=>{config.volume=Number(e.target.value)/100;audio.setVolume(config.volume);persistSettings()});
 $('boxes').addEventListener('change',e=>{config.boxes=e.target.checked;persistSettings();drawTracking(trackedFaces)});
 $('showTexts').addEventListener('change',e=>{config.texts=e.target.checked;persistSettings();$('ritualText').hidden=!config.texts||!activeCue});
 $('testSound').addEventListener('click',async()=>{await unlock();stats.sound=audio.play(undefined,config.scream);updateDebug()});
 $('testScare').addEventListener('click',()=>{if(run.state==='idle'&&lastFace&&capture())trigger(lastFace)});
 setInterval(updateDebug,250);
}
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',()=>updateAudioPrompt());document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else updateAudioPrompt()});
// Try autoplay; no camera or detection starts until audio is ready.
audio.prepare().then(()=>{updateAudioPrompt();if(audio.status!=='running')audio.context.resume().then(updateAudioPrompt).catch(()=>{})}).catch(updateAudioPrompt);
