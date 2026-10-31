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
  AbortController,activeCue:null,performance:{now:()=>now},startDelayMs:2000,psstBeatMs:700,config:{closeWidth:.8},lastFace:face,run:{facePresent:true},
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
console.log('PASS: position-based prompt mapping, repeated matching phrase, ready-on-arrival, visible-eye gate and mid-speech position changes');
