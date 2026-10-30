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
{
 const laugh=deferred(),speech=deferred();let instructions=0,signal;
 const r=new MirrorRun();r.observeFace(true,0);r.start({generate:()=>1,sequence:()=>{},reveal:()=>{},afterReveal:()=>laugh.promise,instruction:s=>{instructions++;signal=s;return speech.promise}});
 await flush();assert.equal(r.state,'after');assert.equal(instructions,0,'Instruction waits until laugh finishes');laugh.resolve();await flush();assert.equal(r.state,'instruction');assert.equal(instructions,1);
 r.observeFace(false,100);r.observeFace(false,1100);assert.equal(r.state,'instruction','Face loss cannot stop post-scare speech');assert.equal(signal.aborted,false);
 r.observeFace(false,3100);assert.equal(r.armed,true);assert.equal(r.state,'instruction','Rearming cannot interrupt the current speech');r.observeFace(true,3200);assert.equal(r.start({}),false,'Another viewer must wait until the ending finishes');
 speech.resolve();await flush();assert.equal(r.state,'idle');assert.equal(instructions,1);
}
{
 const laugh=deferred();let instructions=0;const r=new MirrorRun();r.observeFace(true,0);r.start({generate:()=>1,sequence:()=>{},reveal:()=>{},afterReveal:()=>laugh.promise,instruction:()=>instructions++});await flush();r.observeFace(false,100);r.observeFace(false,1200);assert.equal(r.state,'after');laugh.resolve();await flush();assert.equal(instructions,1,'Ending still plays for a viewer who left after the scare');assert.equal(r.state,'finished');
}
console.log('PASS: post-scare laugh/speech finish despite absence, play once, and block a new run until completion');
{
 const close=deferred(),cues=deferred();let sequences=0,images=0,reveals=0;
 const r=new MirrorRun();r.observeFace(true,0);r.start({approach:()=>close.promise,sequence:()=>{sequences++;return cues.promise},generate:()=>{images++;return 1},reveal:()=>reveals++});
 await flush();assert.equal(r.state,'approach');assert.equal(images,0,'No image request before close enough');assert.equal(sequences,0,'Secret/look sequence waits for close enough');assert.equal(r.start({}),false,'Repeated face detections cannot start more approach loops');
 close.resolve();await flush();assert.equal(r.state,'running');assert.equal(sequences,1);assert.equal(images,1);cues.resolve();await flush();assert.equal(reveals,1);
}
{
 const close=deferred();let sequences=0;
 const r=new MirrorRun();r.observeFace(true,0);r.start({approach:()=>close.promise,sequence:()=>sequences++,generate:()=>assert.fail('Cancelled approach cannot capture'),reveal:()=>assert.fail('Cancelled approach cannot reveal')});
 await flush();r.observeFace(false,100);r.observeFace(false,1099);assert.equal(r.state,'approach');r.observeFace(false,1100);assert.equal(r.state,'finished');close.resolve();await flush();assert.equal(sequences,0);r.observeFace(false,3100);assert.equal(r.state,'idle');
}
console.log('PASS: approach gates narration and generation; one approach loop; 1s loss cancellation and 3s rearm');

{
 const speech=deferred(),second=deferred(),cached={image:'cached',focus:{x:.4,y:.3},target:{x:.5,y:.4}};
 let captures=0,alignments=0,encores=0,first;
 const r=new MirrorRun();r.start({generate:()=>{captures++;return cached},sequence:()=>{},beforeReveal:value=>{alignments++;return value},reveal:value=>{first=value},instruction:()=>speech.promise,encore:(value,signal)=>{encores++;assert.equal(value,first,'Second scare uses the exact prepared image and placement');assert.equal(signal.aborted,false);return second.promise}});
 await flush();assert.equal(r.state,'instruction');assert.equal(encores,0,'Second scare must wait for the ending');
 r.observeFace(false,0);r.observeFace(false,3000);assert.equal(r.armed,true);speech.resolve();await flush();assert.equal(r.state,'reveal');assert.equal(encores,1);assert.equal(captures,1);assert.equal(alignments,1);assert.equal(r.start({}),false,'Rearming cannot overlap the second scare');
 r.observeFace(false,5000);assert.equal(r.state,'reveal','Face loss cannot stop second scare');second.resolve();await flush();assert.equal(r.state,'idle');
}
{
 const speech=deferred();let encores=0;const r=new MirrorRun();r.start({generate:()=>1,sequence:()=>{},reveal:()=>{},instruction:()=>speech.promise,encore:()=>encores++});await flush();r.reset();speech.resolve();await flush();assert.equal(encores,0,'Shutdown during ending must suppress the second scare');assert.equal(r.state,'idle');
}
console.log('PASS: optional cached second scare waits for speech, skips capture/alignment, finishes despite absence, and respects shutdown');
