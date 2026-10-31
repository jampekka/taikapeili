import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual flow with unavailable or clipped eye data.
// Position callbacks are absent: narration must never consult them.
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const routine=app.slice(app.indexOf('async function approach('),app.indexOf('async function loadDetector('));
for(const face of [null,{width:.01,eyes:[]},{width:2,eyes:[{x:-1,y:0},{x:2,y:1}]}]){
 let now=0;const calls=[];
 const context=vm.createContext({AbortController,activeCue:null,lastFace:face,lookMs:4000,run:{finishLine:async(signal,play)=>play()},
  audio:{duration:id=>({opening:3.3,secret:6,look:4})[id],stop(){}},$:()=>({hidden:false}),log(){},updateDebug(){},
  cue(text,id,duration){calls.push({text,id,at:now,duration})},async delay(ms){now+=ms}
 });
 await vm.runInContext(routine+';(async()=>{const signal=new AbortController().signal;await approach(signal);await sequence(signal)})()',context);
 assert.deepEqual(calls.map(c=>c.id),['opening','secret','look']);
 assert.equal(calls[0].at,0,'Full opening starts immediately, without a lead-in');
 assert.equal(calls[0].text,'Psst. Täällä peilissä. Tule tänne.');
 assert.equal(calls[1].at,calls[0].duration,'Secret starts as soon as the full opening finishes');
 assert.equal(calls[2].text,'Katso syvälle silmiin.');
}
console.log('PASS: immediate full opening, automatic secret/look progression and no position or eye-visibility gates');

// Face loss during each real app line must wait for its full duration, then
// suppress the next line/capture. Returning before the line ends may continue.
const {MirrorRun}=await import('../assets/run.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const stopAt of ['opening','secret','look'])for(const returns of [false,true]){
 const r=new MirrorRun(),calls=[],waits=[];let captures=0;
 const scope=vm.createContext({AbortController,run:r,activeCue:null,lookMs:4000,
  audio:{duration:()=>3,stop(){}},$:()=>({hidden:false}),log(){},updateDebug(){},
  cue(text,id){calls.push(id)},delay(ms,signal){return new Promise((resolve,reject)=>{waits.push({resolve,ms});signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true})})}
 });
 const routines=vm.runInContext(routine+';({approach,sequence})',scope);
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
