import assert from 'node:assert/strict';
import {MirrorRun,delay} from '../assets/run.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const imageFirst of [true,false]){
 const image=deferred(),sequence=deferred(),show=deferred();let images=0,sequences=0,reveals=0;
 const r=new MirrorRun();const start=()=>r.start({generate(){images++;return image.promise},sequence(){sequences++;return sequence.promise},reveal(value){assert.equal(value,'portrait');reveals++;return show.promise}});
 assert.equal(start(),true);assert.equal(r.state,'running');await flush();assert.equal(images,1);assert.equal(sequences,1);
 for(let i=0;i<10;i++)assert.equal(start(),false,'Further detections cannot start another run');
 (imageFirst?image:sequence).resolve(imageFirst?'portrait':undefined);await flush();assert.equal(reveals,0,'One completed branch cannot reveal');
 (imageFirst?sequence:image).resolve(imageFirst?undefined:'portrait');await flush();assert.equal(reveals,1);assert.equal(r.state,'reveal');assert.equal(start(),false);
 show.resolve();await flush();assert.equal(r.state,'finished');assert.equal(reveals,1);assert.equal(start(),false,'A continuously present face cannot repeat the sequence');r.observeFace(false,100);r.observeFace(false,3099);assert.equal(r.armed,false);r.observeFace(false,3100);assert.equal(r.state,'idle');assert.equal(r.armed,true);
}
{
 const image=deferred(),sequence=deferred();let reveals=0;const r=new MirrorRun();r.start({generate:()=>image.promise,sequence:()=>sequence.promise,reveal:()=>reveals++});await flush();r.reset();image.resolve('stale');sequence.resolve();await flush();assert.equal(reveals,0,'Explicit shutdown discards stale results');assert.equal(r.state,'idle');
}
{
 const r=new MirrorRun();r.start({generate:()=>Promise.reject(new Error('failure')),sequence:signal=>delay(100000,signal),reveal:()=>assert.fail('No reveal on failure')});await flush();assert.equal(r.state,'error');assert.match(r.error.message,/failure/);r.reset();assert.equal(r.state,'idle');
}
console.log('PASS: concurrent start; early/late image barrier; one capture/reveal; repeated detections ignored; shutdown; visible error and reset');

{
 const image=deferred(),sequence=deferred();let latestEyeY=.3,revealed;
 const r=new MirrorRun();r.start({generate:()=>image.promise,sequence:()=>sequence.promise,beforeReveal:value=>({...value,target:latestEyeY}),reveal:value=>{revealed=value}});
 await flush();image.resolve({capturedEyeY:.3});latestEyeY=.6;sequence.resolve();await flush();
 assert.equal(revealed.capturedEyeY,.3);assert.equal(revealed.target,.6,'Reveal positioning reads the latest eyes after both branches finish');
}
console.log('PASS: reveal measures current eye position after the image/sequence barrier');
{
 const sequence=deferred();let frame='early',generated=0,revealed;
 const r=new MirrorRun();r.start({generateAfterSequence:true,sequence:()=>sequence.promise,generate:()=>{generated++;return frame},reveal:image=>{revealed=image}});
 await flush();assert.equal(generated,0,'Dummy must not capture at first detection');frame='latest';sequence.resolve();await flush();assert.equal(generated,1);assert.equal(revealed,'latest','Dummy uses the frame available when the sequence finishes');
}
{
 const sequence=deferred();let generated=0;const r=new MirrorRun();r.start({generateAfterSequence:true,sequence:()=>sequence.promise,generate:()=>generated++,reveal:()=>assert.fail('Cancelled run')});await flush();r.reset();sequence.resolve();await flush();assert.equal(generated,0,'Shutdown before final capture must not start dummy processing');
}
console.log('PASS: dummy captures only after cues, reads newest frame, and skips capture after shutdown');

{
 const sequence=deferred();let captures=0;
 const r=new MirrorRun();r.start({generateAfterSequence:true,generate:()=>captures++,sequence:()=>sequence.promise,reveal:()=>assert.fail('Cancelled sequence must not reveal')});await flush();
 r.observeFace(false,100);r.observeFace(false,1099);assert.equal(r.state,'running');r.observeFace(false,1100);assert.equal(r.state,'finished','One second of face loss cancels');assert.equal(r.armed,false);
 sequence.resolve();await flush();assert.equal(captures,0);r.observeFace(false,3099);assert.equal(r.state,'finished');r.observeFace(false,3100);assert.equal(r.state,'idle','Three seconds of absence rearms');
}
{
 const sequence=deferred(),image=deferred();const r=new MirrorRun();r.start({generate:()=>image.promise,sequence:()=>sequence.promise,reveal:()=>{}});await flush();r.observeFace(false,0);r.observeFace(false,800);r.observeFace(true,900);r.observeFace(false,1000);r.observeFace(false,1800);assert.equal(r.state,'running','Reappearance resets the missing-face clock');r.reset();sequence.resolve();image.resolve();await flush();
}
{
 const shown=deferred(),laugh=deferred();let laughs=0;const r=new MirrorRun();r.start({generate:()=>1,sequence:()=>{},reveal:()=>shown.promise,afterReveal:()=>{laughs++;return laugh.promise}});await flush();assert.equal(r.state,'reveal');assert.equal(laughs,0);shown.resolve();await flush();assert.equal(r.state,'after');assert.equal(laughs,1);assert.equal(r.start({}),false);laugh.resolve();await flush();assert.equal(r.state,'finished');
}
console.log('PASS: 1s cancellation, 3s absence rearm, brief-loss recovery, no repeated run, post-reveal completion ordering');
