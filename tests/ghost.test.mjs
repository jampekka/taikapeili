import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ghostVisible,ghostLayout,GhostOverlay} from '../assets/ghost.js';
assert.equal(ghostVisible('approach',false),false,'Keep the initial lead-in empty');
for(const state of ['approach','running','instruction'])assert.equal(ghostVisible(state,true),true);
for(const state of ['reveal','after','error','finished'])assert.equal(ghostVisible(state,true,true),false,'Preview cannot override a scare blackout');
assert.equal(ghostVisible('idle',false),false);
assert.equal(ghostVisible('idle',false,true),true);
for(const [w,h] of [[768,1024],[1024,768],[375,812]]){
 const r=ghostLayout(w,h);assert.ok(r.x>=0&&r.y>=0);assert.ok(r.width<=w&&r.height<=h);
 assert.ok((r.y+r.height*.317)/h<.45,'Ghost eyes stay above the middle');
}
// Rendering test: video denial falls back to the still; blackout is immediate.
let cleared=0,drawn=0,paused=true;
const context={clearRect(){cleared++},save(){},restore(){},drawImage(){drawn++}};
globalThis.Image=class{complete=true;naturalWidth=1280};
globalThis.document={createElement(){return {readyState:0,get paused(){return paused},setAttribute(){},addEventListener(){},play(){return Promise.reject(Error('blocked'))},pause(){paused=true}}}};
const canvas={width:768,height:1024,getContext(){return context},getBoundingClientRect(){return {width:768,height:1024}}};
const ghost=new GhostOverlay(canvas);
ghost.draw(0,{visible:true});ghost.draw(500,{visible:true});await Promise.resolve();
assert.ok(drawn>0,'Still renders when video is unavailable');assert.ok(ghost.target);
ghost.draw(501,{visible:true,blackout:true});assert.equal(ghost.target,null);assert.equal(ghost.opacity,0);assert.ok(cleared>0);
const reduced=new GhostOverlay(canvas,{reduced:true});reduced.draw(0,{visible:true});reduced.draw(500,{visible:true});assert.equal(reduced.playing,false,'Reduced motion uses the still');
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const prepare=app.slice(app.indexOf('function beforeReveal('),app.indexOf('async function reveal('));
const renderer={projectPoint:p=>p,ghostTarget:{x:.5,y:.32}},result={focus:{x:.4,y:.6}};
const scope=vm.createContext({renderer,liveEyes:null,result});
assert.equal(vm.runInContext(prepare+';beforeReveal(result).target',scope),renderer.ghostTarget,'Scare lands where the viewer was watching the ghost');
renderer.ghostTarget=null;
const fallback=vm.runInContext('beforeReveal(result).target',scope);assert.equal(fallback.x,.4);assert.equal(fallback.y,.6,'Disabled/hidden ghost preserves the tracked-eye alignment');
console.log('PASS: ghost timing, safe layout, still fallback and immediate scare blackout');
