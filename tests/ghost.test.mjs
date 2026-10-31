import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ghostVisible,ghostLayout,GhostOverlay,smoothGhostVoice,ghostMotion,ghostGaze} from '../assets/ghost.js';
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
let cleared=0,drawn=0,paused=true;const paints=[];
const context={translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},quadraticCurveTo(){},closePath(){},ellipse(){},fill(){},clearRect(){cleared++},save(){},restore(){},drawImage(image){drawn++;paints.push({image,blend:this.globalCompositeOperation,alpha:this.globalAlpha})}};
globalThis.Image=class{complete=true;naturalWidth=1280;decode(){return Promise.resolve()}};
globalThis.document={createElement(tag){return tag==='canvas'?{getContext(){return {...context}}}:{readyState:2,get paused(){return paused},setAttribute(){},addEventListener(){},play(){paused=false;return Promise.resolve()},pause(){paused=true}}}};
const canvas={width:768,height:1024,getContext(){return context},getBoundingClientRect(){return {width:768,height:1024}}};
const ghost=new GhostOverlay(canvas);await ghost.prepare('soft');
ghost.draw(0,{visible:true,voice:.4});ghost.draw(100,{visible:true,voice:.4});
const earlyOpacity=ghost.opacity;for(let at=200;at<=1000;at+=100)ghost.draw(at,{visible:true,voice:.4});await Promise.resolve();
assert.ok(drawn>0);assert.ok(ghost.target);assert.ok(earlyOpacity<ghost.opacity&&ghost.opacity>.8,'Long voice window fades in to a clearly visible head');
const speakingOpacity=ghost.opacity;for(let at=1100;at<=1800;at+=100)ghost.draw(at,{visible:true,voice:0});assert.ok(ghost.opacity<speakingOpacity&&ghost.opacity>speakingOpacity*.5,'Short pauses fade gently instead of flickering');
assert.ok(paints.some(p=>p.image===ghost.image&&p.blend==='source-over'&&p.alpha===1),'Real alpha cutout is always underneath the video');
assert.ok(paints.some(p=>p.image===ghost.video&&p.blend==='source-atop'&&p.alpha<.5),'Video cannot replace or erase the cutout');
assert.ok(paints.some(p=>p.image===ghost.layer&&p.blend==='source-over'),'Foreground uses normal alpha, not screen blending');
ghost.draw(1801,{visible:true,blackout:true});assert.equal(ghost.target,null);assert.equal(ghost.opacity,0);assert.ok(cleared>0);
ghost.setPhase('reveal');for(const phase of ['after','instruction','finished','idle']){ghost.setPhase(phase);ghost.draw(1900,{visible:true,voice:1,preview:true});assert.equal(ghost.opacity,0,'Post-startle suppression survives ending speech, idle and debug preview');assert.equal(ghost.target,null)}
ghost.setPhase('approach');ghost.draw(2000,{visible:true,voice:.4});assert.equal(ghost.suppressed,false);assert.ok(ghost.opacity>0,'Only a fresh sequence releases suppression');
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
const view=vm.createContext({source:{},config:{ghostEnabled:true,ghostOpacity:.9,ghostSize:1.15,ghostStyle:'soft'},run:{state:'idle'},debug:false,activeCue:null,ghostPreviewUntil:0,audio:{speaking:true},renderer:{speechPulse:0},ghostVisible,ghost:{draw(now,options){drawnOptions=options}}});
vm.runInContext(drawRoutine+';drawGhost(0)',view);assert.equal(drawnOptions.visible,true,'Actual playback shows the ghost even during silent syllable gaps and outside a sequence');

let envelope=0;for(let i=0;i<70;i++)envelope=smoothGhostVoice(envelope,.4,10);
assert.ok(Math.abs(envelope-.4*(1-Math.exp(-1)))<1e-10,'700ms attack is independent of frame rate');
assert.equal(smoothGhostVoice(.3,0,0),.3);
assert.ok(smoothGhostVoice(.3,0,1000)>.15,'Release uses a long 1.5s window');
assert.ok(smoothGhostVoice(envelope,0,10000)<.001,'Sustained silence fades to transparent');
for(let now=0;now<100000;now+=137){const pose=ghostMotion(now);assert.ok(Math.abs(pose.x)<=.016&&Math.abs(pose.y)<=.016&&Math.abs(pose.rotation)<=.008);const gaze=ghostGaze(now);assert.ok(Math.abs(gaze.x)<=.0035&&Math.abs(gaze.y)<=.002)}
assert.notDeepEqual(ghostMotion(0),ghostMotion(3000),'Hover advances without video playback');
assert.deepEqual(ghostMotion(0,0),{x:0,y:0,rotation:0,scale:1});
assert.deepEqual(ghostGaze(800),ghostGaze(2200),'Eyes fixate between brief small saccades');
view.ghost.suppressed=true;vm.runInContext('drawGhost(3000)',view);assert.equal(drawnOptions.visible,false,'App respects the post-startle latch even when a voice test is playing');
console.log('PASS: bounded hover/saccades, live long-window voice fade and post-startle suppression until next approach');
