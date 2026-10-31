import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ghostVisible,ghostLayout,GhostOverlay,smoothGhostVoice,ghostMotion,ghostGaze,ghostEyePose,ghostFaceWidth,GHOST_STYLES,followGhostPose} from '../assets/ghost.js';
assert.equal(ghostVisible('approach',false),false,'Keep the initial lead-in empty');
for(const state of ['approach','running'])assert.equal(ghostVisible(state,true),true);
for(const state of ['reveal','after','instruction','error','finished'])assert.equal(ghostVisible(state,true,true),false,'Preview cannot override a scare blackout');
assert.equal(ghostVisible('idle',false),false);
assert.equal(ghostVisible('idle',false,true),true);
assert.equal(ghostVisible('idle',false,false,true),true,'Direct voice tests show the ghost');
for(const state of ['reveal','after','instruction','finished'])assert.equal(ghostVisible(state,true,true,true),false,'Speech and preview cannot bring the ghost back after a scare');
assert.equal(ghostVisible('reveal',true,true,true),false,'The scare blackout overrides speech');
for(const [w,h] of [[768,1024],[1024,768],[375,812]]){
 const r=ghostLayout(w,h);
 assert.equal(r.x+r.width/2,w/2,'Head is horizontally centred');
 assert.equal(r.y+r.height/2,h/2,'Head is vertically centred');
 // Transparent video-frame margins may extend outside the mirror; head stays in it.
 assert.ok(r.x+r.width*.15>=0&&r.x+r.width*.85<=w);
 assert.ok(r.y+r.height*.14>=0&&r.y+r.height*.86<=h);
 if(w===768)assert.ok(r.height*.72/h>.75,'Large head on a portrait iPad');
}
// Missing/black iOS video still leaves the alpha cutout visible in normal blend.
let cleared=0,drawn=0,paused=true;const paints=[],eyePoints=[];
const context={createRadialGradient(){return {addColorStop(){}}},translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},quadraticCurveTo(){},closePath(){},ellipse(x,y,rx,ry){eyePoints.push({context:this,alpha:this.globalAlpha,rx,ry,fill:this.fillStyle})},fill(){},clearRect(){cleared++},save(){},restore(){},drawImage(image){drawn++;paints.push({image,blend:this.globalCompositeOperation,alpha:this.globalAlpha})}};
globalThis.Image=class{complete=true;naturalWidth=1280;decode(){return Promise.resolve()}};
globalThis.document={createElement(tag){return tag==='canvas'?{getContext(){return {...context}}}:{readyState:2,get paused(){return paused},setAttribute(){},addEventListener(){},play(){paused=false;return Promise.resolve()},pause(){paused=true}}}};
const canvas={width:768,height:1024,getContext(){return context},getBoundingClientRect(){return {width:768,height:1024}}};
const ghost=new GhostOverlay(canvas);await ghost.prepare('soft');
ghost.draw(0,{visible:true,voice:.4});ghost.draw(100,{visible:true,voice:.4});
const earlyOpacity=ghost.opacity;for(let at=200;at<=1000;at+=100)ghost.draw(at,{visible:true,voice:.4});await Promise.resolve();
assert.ok(drawn>0);assert.ok(ghost.target);assert.ok(earlyOpacity<ghost.opacity&&ghost.opacity>.2&&ghost.opacity<.5,'An eight-second voice window leaves the apparition still slowly fading in at one second');
for(let at=1100;at<=8000;at+=100)ghost.draw(at,{visible:true,voice:.4});
assert.ok(ghost.opacity>.85,'Sustained speech eventually brings the ghost fully forward');
assert.ok(eyePoints.length>0&&eyePoints.every(p=>p.context!==context&&p.alpha===1),'Eyes are part of the head layer, never a separately faded overdraw');
const cores=eyePoints.filter(p=>p.fill==='#fff');
assert.ok(cores.length>0&&cores.every(p=>p.rx===p.ry&&p.rx<2),'Eyes are tiny round points with no almond outline');
assert.ok(eyePoints.some(p=>typeof p.fill==='object'&&p.rx>2),'A soft radial halo surrounds each point');
const speakingOpacity=ghost.opacity;for(let at=8100;at<=8800;at+=100)ghost.draw(at,{visible:true,voice:0});assert.ok(ghost.opacity<speakingOpacity&&ghost.opacity>speakingOpacity*.5,'Short pauses fade gently instead of flickering');
assert.ok(paints.some(p=>p.image===ghost.image&&p.blend==='source-over'&&p.alpha===1),'Real alpha cutout is always underneath the video');
assert.ok(paints.some(p=>p.image===ghost.video&&p.blend==='source-atop'&&p.alpha<.5),'Video cannot replace or erase the cutout');
assert.ok(paints.some(p=>p.image===ghost.layer&&p.blend==='source-over'),'Foreground uses normal alpha, not screen blending');
ghost.draw(8801,{visible:true,blackout:true});assert.equal(ghost.target,null);assert.equal(ghost.opacity,0);assert.ok(cleared>0);
ghost.setPhase('reveal');for(const phase of ['after','instruction','finished','idle']){ghost.setPhase(phase);ghost.draw(8900,{visible:true,voice:1,preview:true});assert.equal(ghost.opacity,0,'Post-startle suppression survives ending speech, idle and debug preview');assert.equal(ghost.target,null)}
ghost.setPhase('approach');ghost.draw(9000,{visible:true,voice:.4});ghost.draw(9100,{visible:true,voice:.4});assert.equal(ghost.suppressed,false);assert.ok(ghost.opacity>0,'Only a fresh sequence releases suppression');
const reduced=new GhostOverlay(canvas,{reduced:true});reduced.draw(0,{visible:true});reduced.draw(500,{visible:true});assert.equal(reduced.playing,false,'Reduced motion uses the still');
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const prepare=app.slice(app.indexOf('function beforeReveal('),app.indexOf('async function reveal('));
const renderer={projectPoint:p=>p,ghostTarget:{x:.5,y:.32}},result={focus:{x:.4,y:.6}};
const scope=vm.createContext({renderer,liveEyes:null,result});
assert.equal(vm.runInContext(prepare+';beforeReveal(result).target',scope),renderer.ghostTarget,'Scare lands where the viewer was watching the ghost');
renderer.ghostTarget=null;
const fallback=vm.runInContext('beforeReveal(result).target',scope);assert.equal(fallback.x,.4);assert.equal(fallback.y,.6,'Disabled/hidden ghost preserves the tracked-eye alignment');
console.log('PASS: ghost timing, safe layout, still fallback and immediate scare blackout');

const drawRoutine=app.slice(app.indexOf('function drawGhost('),app.indexOf('const renderer=new MirrorRenderer'));
let drawnOptions;
const view=vm.createContext({source:{},config:{ghostEnabled:true,ghostOpacity:.9,ghostSize:1.15,ghostStyle:'soft'},run:{state:'idle'},debug:false,lastFace:null,stats:{eyesSeenAt:0},bothEyesVisible:()=>false,activeCue:null,ghostPreviewUntil:0,audio:{speaking:true},renderer:{speechPulse:0},ghostVisible,ghost:{draw(now,options){drawnOptions=options}}});
vm.runInContext(drawRoutine+';drawGhost(0)',view);assert.equal(drawnOptions.visible,true,'Actual playback shows the ghost even during silent syllable gaps and outside a sequence');

let envelope=0;for(let i=0;i<800;i++)envelope=smoothGhostVoice(envelope,.4,10);
assert.ok(Math.abs(envelope-.4*(1-Math.exp(-1)))<1e-10,'Eight-second smoothing is independent of frame rate');
assert.equal(smoothGhostVoice(.3,0,0),.3);
assert.ok(smoothGhostVoice(.3,0,1000)>.25,'Release uses the same long eight-second window');
assert.ok(smoothGhostVoice(envelope,0,80000)<.001,'Sustained silence fades to transparent');
let minZoom=2,maxZoom=0;
for(let now=0;now<100000;now+=137){const pose=ghostMotion(now);assert.ok(Math.abs(pose.x)<=.016&&Math.abs(pose.y)<=.016&&Math.abs(pose.rotation)<=.008);assert.ok(pose.scale>=.975&&pose.scale<=1.025);minZoom=Math.min(minZoom,pose.scale);maxZoom=Math.max(maxZoom,pose.scale);const gaze=ghostGaze(now);assert.ok(Math.abs(gaze.x)<=.0035&&Math.abs(gaze.y)<=.002)}
assert.ok(maxZoom-minZoom>.049,'Head visibly breathes in and out over a bounded 5% zoom range');
assert.notDeepEqual(ghostMotion(0),ghostMotion(3000),'Hover advances without video playback');
assert.deepEqual(ghostMotion(0,0),{x:0,y:0,rotation:0,scale:1});
assert.deepEqual(ghostGaze(800),ghostGaze(2200),'Eyes fixate between brief small saccades');
view.ghost.suppressed=true;vm.runInContext('drawGhost(3000)',view);assert.equal(drawnOptions.visible,false,'App respects the post-startle latch even when a voice test is playing');
console.log('PASS: bounded hover/saccades, live long-window voice fade and post-startle suppression until next approach');

for(const [w,h] of [[768,1024],[1024,768]])for(const style of Object.values(GHOST_STYLES))for(const angle of [-.5,0,.5]){
 const layout=ghostLayout(w,h),gaze={x:.003,y:-.002},cx=w*.42,cy=h*.38;
 let reference;
 for(const span of [40,100,250]){
  const eyes=[-1,1].map(side=>({x:(cx+side*Math.cos(angle)*span/2)/w,y:(cy+side*Math.sin(angle)*span/2)/h}));
  const pose=ghostEyePose(eyes,w,h,layout,style,gaze);assert.equal(pose.scale,1,'Viewer distance must never scale the ghost');
  assert.ok(Math.abs(pose.rotation-angle)<1e-10);
  const px=((style.eyeX[0]+style.eyeX[1])/2+gaze.x-.5)*layout.width,py=(.1+.8*style.eyeY+gaze.y-.5)*layout.height;
  assert.ok(Math.abs(pose.cx+px*Math.cos(pose.rotation)-py*Math.sin(pose.rotation)-cx)<1e-9);
  assert.ok(Math.abs(pose.cy+px*Math.sin(pose.rotation)+py*Math.cos(pose.rotation)-cy)<1e-9,'Ghost eye midpoint coincides with the viewer eye midpoint');
  if(reference)assert.ok(Math.hypot(pose.cx-reference.cx,pose.cy-reference.cy)<1e-9,'Changing only eye distance changes neither placement nor size');
  reference=pose;
 }
}
assert.equal(ghostEyePose(null,768,1024,ghostLayout(768,1024),GHOST_STYLES.soft),null);
for(const name of Object.keys(GHOST_STYLES)){
 const actual=ghostFaceWidth(768,1024,1.15,name);assert.ok(actual>0&&actual<ghostLayout(768,1024).width/768,'Face width excludes transparent frame margins');
 assert.equal(ghostFaceWidth(384,512,1.15,name),actual,'Closeness reference is independent of render resolution');
}
console.log('PASS: fixed-size rigid eye alignment, head tilt, gaze compensation and intrinsic ghost face width');

const basePose={x:.5,y:.4,rotation:Math.PI-.02,scale:1},newPose={x:.7,y:.6,rotation:-Math.PI+.02,scale:.65};
const oneStep=followGhostPose(basePose,newPose,450,.45);let manySteps=basePose;
for(let i=0;i<45;i++)manySteps=followGhostPose(manySteps,newPose,10,.45);
assert.ok(Math.abs(oneStep.x-manySteps.x)<1e-10&&Math.abs(oneStep.scale-manySteps.scale)<1e-10,'EMA follows the same path at different frame rates');
assert.ok(oneStep.x>.5&&oneStep.x<.7&&oneStep.scale>.65&&oneStep.scale<1,'Position and scale tail their targets instead of jumping');
assert.ok(Math.abs(oneStep.rotation-basePose.rotation)<.04,'Rotation follows the short path across the angle wrap');
const layout=ghostLayout(768,1024),style=GHOST_STYLES.soft,eyeSpan=(style.eyeX[1]-style.eyeX[0])*layout.width;
const eyesAtSpan=span=>[{x:.6-span/768/2,y:.55},{x:.6+span/768/2,y:.55}];
assert.equal(ghostEyePose(eyesAtSpan(eyeSpan*.2),768,1024,layout,style,{x:0,y:0},{scaleToEyes:true,minScale:.65}).scale,.65);
assert.ok(Math.abs(ghostEyePose(eyesAtSpan(eyeSpan*1.3),768,1024,layout,style,{x:0,y:0},{scaleToEyes:true,minScale:.65}).scale-1.3)<1e-10,'Optional scale matches eye distance above the minimum');
const trailing=new GhostOverlay(canvas,{reduced:true});
for(let at=0;at<=3000;at+=100)trailing.draw(at,{visible:true,voice:.4,eyes:eyesAtSpan(eyeSpan),eyesAt:at,followSeconds:.45});
const tracked={...trailing.followPose};assert.ok(Math.abs(tracked.x-.6)<.001);
for(let at=3100;at<=4400;at+=100)trailing.draw(at,{visible:true,voice:.4,eyes:null,followSeconds:.45});
assert.ok(Math.abs(trailing.followPose.x-.6)<.001,'Brief tracking loss holds the last eye target');
trailing.draw(4600,{visible:true,voice:.4,eyes:null,followSeconds:.45});
assert.ok(trailing.followPose.x<.6&&trailing.followPose.x>.5,'After 1.5s loss the return begins smoothly');
for(let at=4700;at<=7000;at+=100)trailing.draw(at,{visible:true,voice:.4,eyes:null,followSeconds:.45});
assert.ok(Math.abs(trailing.followPose.x-.5)<.01,'Sustained loss eases back to the default pose');
trailing.draw(7100,{visible:true,voice:.4,eyes:eyesAtSpan(eyeSpan),eyesAt:3000,followSeconds:.45});
assert.equal(trailing.followEyes,null,'A stale tracker result cannot pin the ghost indefinitely');
console.log('PASS: optional minimum scale, EMA tailing, angle wrap, tracking-loss hold and smooth return');
