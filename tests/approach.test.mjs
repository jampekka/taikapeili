import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual flow with unavailable or clipped eye data.
// Position callbacks are absent: narration must never consult them.
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const routine=app.slice(app.indexOf('async function approach('),app.indexOf('async function loadDetector('));
for(const face of [null,{width:.01,eyes:[]},{width:2,eyes:[{x:-1,y:0},{x:2,y:1}]}]){
 let now=0;const calls=[];
 const context=vm.createContext({AbortController,activeCue:null,lastFace:face,lookMs:4000,
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
