import assert from 'node:assert/strict';
import {cameraToMirror,faceToMirror,FaceTracker} from '../assets/tracker.js';
// The full camera is tracked; only the mirror view is cropped and reflected.
assert.deepEqual(cameraToMirror({x:.5,y:.5},4/3,3/4),{x:.5,y:.5});
const left=cameraToMirror({x:0,y:.5},4/3,3/4),right=cameraToMirror({x:1,y:.5},4/3,3/4);
assert.ok(left.x>1&&right.x<0,'Camera edges remain outside a narrower mirror crop');
const f=faceToMirror({center:{x:.5,y:.5},width:.2,height:.3,eyes:[{x:.45,y:.4},{x:.55,y:.4}]},4/3,3/4);
assert.ok(f.eyes[0].x<f.eyes[1].x);assert.equal(f.eyes[0].y,.4);assert.ok(Math.abs(f.width-.2/(.75/(4/3)))<1e-9);
const portrait=cameraToMirror({x:.3,y:.4},.75,4/3);assert.equal(portrait.x,.7);assert.ok(portrait.y<.4,'Landscape display crops camera height');
let worker,resolveBitmap;const messages=[];globalThis.Worker=class{constructor(){worker=this}postMessage(data){messages.push(data)}};
globalThis.createImageBitmap=()=>new Promise(resolve=>{resolveBitmap=resolve});
const received=[],tracker=new FaceTracker(data=>received.push(data));worker.onmessage({data:{type:'ready',backend:'test'}});await tracker.ready;
const first=tracker.submit({width:320,height:240},100,3);await tracker.submit({},101,3);assert.equal(messages.length,1,'A frame in flight cannot create an inference queue');
resolveBitmap({});await first;assert.equal(messages.length,2);assert.equal(messages[1].epoch,3);assert.equal(tracker.busy,true);
worker.onmessage({data:{type:'result',faces:[]}});assert.equal(tracker.busy,false);assert.equal(received.length,1);
console.log('PASS: full-camera crop/mirror eye mapping; one frame in flight, no inference queue');
