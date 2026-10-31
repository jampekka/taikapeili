import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual app routine with a clock and changing viewer position.
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const routine=app.slice(app.indexOf('async function approach('),app.indexOf('async function sequence('));
async function simulate({near,facing,eyes=true,onCue,readyAt=9000}){
 let now=0;const face={width:near ? .6 : .3},scene={facing,eyes},calls=[];
 const ready=()=>{face.width=.6;scene.facing=true;scene.eyes=true};
 const context=vm.createContext({
  AbortController,activeCue:null,performance:{now:()=>now},config:{closeWidth:.8},lastFace:face,run:{facePresent:true,finishLine:async(signal,play)=>play()},
  closeFaceWidth:()=>.6*.8,renderer:{projectPoint:p=>p},headFacing:()=>scene.facing,bothEyesVisible:()=>scene.eyes,
  audio:{duration:()=>.25,stop(){}},$:()=>({hidden:false}),log(){},
  cue(text,id,duration,clipSeconds){calls.push({text,id,at:now,duration,clipSeconds});onCue?.({text,id,face,scene,ready})},
  async delay(ms){now+=ms;if(now>=readyAt)ready();if(now>15000)throw Error('Approach did not finish')}
 });
 await vm.runInContext(routine+';approach(new AbortController().signal)',context);
 return {calls,now};
}
for(const [near,facing,id] of [[false,false,'opening'],[false,true,'come'],[true,false,'here']]){
 const {calls}=await simulate({near,facing});assert.ok(calls.length>=3);assert.equal(calls[0].text,'Psst. Täällä peilissä. Tule tänne.');assert.equal(calls[0].clipSeconds,undefined);assert.ok(calls.slice(1).every(c=>c.id===id),'Repeat only the phrase matching the viewer position');
}
const readyViewer=await simulate({near:true,facing:true});
assert.equal(readyViewer.calls[0].at,0,'First complete Psst line starts with no lead-in');
assert.deepEqual(readyViewer.calls.map(c=>c.text),['Psst. Täällä peilissä. Tule tänne.'],'Already ready viewers still hear the opening cue');
assert.ok(readyViewer.now>=readyViewer.calls[0].at+readyViewer.calls[0].duration+700,'The opening cue gets a beat before the secret starts');
assert.ok((await simulate({near:true,facing:true,eyes:false})).calls.slice(1).every(c=>c.id==='opening'),'Eyes outside the view only repeat the complete Psst opening');
for(const near of [false,true])for(const facing of [false,true])assert.ok((await simulate({near,facing,eyes:false})).calls.every(c=>c.id==='opening'),'Clipped eyes override closeness and head facing');
let openingCues=0;
const changing=await simulate({near:false,facing:false,readyAt:Infinity,onCue({id,face,scene,ready}){
 if(id==='opening'){if(openingCues++)scene.facing=true}
 else if(id==='come'){face.width=.6;scene.facing=false}
 else ready();
}});
assert.deepEqual(changing.calls.map(c=>c.id),['opening','opening','come','here']);
for(let i=1;i<changing.calls.length;i++)assert.ok(changing.calls[i].at>=changing.calls[i-1].at+changing.calls[i-1].duration,'Position changes cannot overlap recordings');
assert.ok(changing.now>=changing.calls.at(-1).at+changing.calls.at(-1).duration,'Finish the current phrase before advancing');
console.log('PASS: immediate first Psst, restored position-based prompts and gates, and every phrase finishes before progression');

// Face loss during each real app line must wait for its full duration, then
// suppress the next line/capture. Returning before the line ends may continue.
const {MirrorRun}=await import('../assets/run.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const stopAt of ['opening','secret','look'])for(const returns of [false,true]){
 const r=new MirrorRun(),calls=[],waits=[];let captures=0,now=0;
 const scope=vm.createContext({AbortController,run:r,activeCue:null,lookMs:4000,performance:{now:()=>now},lastFace:{width:.8},closeFaceWidth:()=>.6,headFacing:()=>true,bothEyesVisible:()=>true,renderer:{projectPoint:p=>p},
  audio:{duration:()=>3,stop(){}},$:()=>({hidden:false}),log(){},updateDebug(){},
  cue(text,id){calls.push(id)},delay(ms,signal){return new Promise((resolve,reject)=>{waits.push({resolve:()=>{now+=ms;resolve()},ms});signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true})})}
 });
 const routines=vm.runInContext(app.slice(app.indexOf('async function approach('),app.indexOf('async function loadDetector('))+';({approach,sequence})',scope);
 r.observeFace(true,0);r.start({...routines,generateAfterSequence:true,generate:()=>++captures,reveal:()=>{}});
 await flush();
 while(calls.at(-1)!==stopAt){waits.shift().resolve();await flush()}
 const signal=r.active.controller.signal,state=r.state;
 r.observeFace(false,100);r.observeFace(false,1100);
 assert.equal(signal.aborted,false,`${stopAt} must not be cut short by face loss`);
 assert.equal(r.state,state);assert.equal(r.start({}),false,'Rearming cannot overlap the unfinished line');
 if(returns)r.observeFace(true,1200);
 waits.shift().resolve();await flush();
 if(!returns){assert.equal(signal.aborted,true);assert.equal(captures,0);assert.equal(calls.at(-1),stopAt);assert.equal(r.state,'idle')}
 else{while(waits.length){waits.shift().resolve();await flush()}await r.active?.done;assert.equal(captures,1,'A returning viewer continues after the completed line')}
}
console.log('PASS: all spoken lines finish after face loss; absent viewers stop between lines and returning viewers continue');

for(const clippedDuring of ['secret','look']){
 let eyes=true,now=0;const calls=[],waits=[];
 const scope=vm.createContext({AbortController,activeCue:null,lookMs:4000,performance:{now:()=>now},lastFace:{width:.8},closeFaceWidth:()=>.6,headFacing:()=>true,bothEyesVisible:()=>eyes,renderer:{projectPoint:p=>p},run:{facePresent:true,finishLine:async(signal,play)=>play()},audio:{duration:()=>3,stop(){}},$:()=>({hidden:false}),log(){},updateDebug(){},cue(text,id){calls.push(id)},delay(ms){return new Promise(resolve=>waits.push(()=>{now+=ms;resolve()}))}});
 const pending=vm.runInContext(app.slice(app.indexOf('async function approach('),app.indexOf('async function loadDetector('))+';sequence(new AbortController().signal)',scope);
 while(calls.at(-1)!==clippedDuring){waits.shift()();await flush()}
 eyes=false;await flush();assert.equal(calls.at(-1),clippedDuring,'Changing eye visibility never interrupts the active line');
 waits.shift()();await flush();assert.equal(calls.at(-1),'opening','Only after finishing the line does clipped-eye narration return to Psst');
 eyes=true;while(waits.length){waits.shift()();await flush()}await pending;
 assert.deepEqual(calls.slice(-3),['opening','secret','look']);
}
console.log('PASS: clipped eyes return to positioning prompts only after the current narration line finishes');
