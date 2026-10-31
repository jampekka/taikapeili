import assert from 'node:assert/strict';
import {cameraToMirror,faceToMirror,bothEyesVisible,facingMirror,FaceTracker,scanFaceToMirror} from '../assets/tracker.js';
// The full camera is tracked; only the mirror view is cropped and reflected.
assert.deepEqual(cameraToMirror({x:.5,y:.5},4/3,3/4),{x:.5,y:.5});
const left=cameraToMirror({x:0,y:.5},4/3,3/4),right=cameraToMirror({x:1,y:.5},4/3,3/4);
assert.ok(left.x>1&&right.x<0,'Camera edges remain outside a narrower mirror crop');
const f=faceToMirror({center:{x:.5,y:.5},width:.2,height:.3,eyes:[{x:.45,y:.4},{x:.55,y:.4}]},4/3,3/4);
assert.ok(f.eyes[0].x<f.eyes[1].x);assert.equal(f.eyes[0].y,.4);assert.ok(Math.abs(f.width-.2/(.75/(4/3)))<1e-9);
const portrait=cameraToMirror({x:.3,y:.4},.75,4/3);assert.equal(portrait.x,.7);assert.ok(portrait.y<.4,'Landscape display crops camera height');
// A large face in the raw camera must not pass the gate if the displayed crop hides an eye.
const cropFace=eyes=>faceToMirror({center:{x:.2,y:.5},width:.4,height:.5,eyes},4/3,3/4);
const outside=cropFace([{x:.05,y:.4},{x:.15,y:.4}]);assert.ok(outside.width>.45);assert.equal(bothEyesVisible(outside),false);
const oneEye=cropFace([{x:.2,y:.4},{x:.35,y:.4}]);assert.equal(bothEyesVisible(oneEye),false);
const visible=cropFace([{x:.35,y:.4},{x:.6,y:.4}]);assert.equal(bothEyesVisible(visible),true);
const vertical=faceToMirror({center:{x:.5,y:.1},width:.6,height:.5,eyes:[{x:.35,y:.1},{x:.65,y:.1}]},3/4,4/3);assert.equal(bothEyesVisible(vertical),false,'Reject eyes above the landscape display crop');
assert.equal(bothEyesVisible(visible,eye=>({...eye,x:eye.x+1})),false,'Also account for the visible live morph');
for(const face of [null,{}, {eyes:[]},{eyes:[{x:.5,y:.5}]},{eyes:[{x:NaN,y:.5},{x:.6,y:.5}]}])assert.equal(!!bothEyesVisible(face),false);
console.log('PASS: width alone cannot advance approach; both eyes must be in the actual display crop and projected view');
const front={center:{x:.5,y:.5},width:.4,height:.6,eyes:[{x:.4,y:.4},{x:.6,y:.4}],nose:{x:.5,y:.5}};
assert.equal(facingMirror(front),true);
assert.equal(facingMirror({...front,nose:{x:.58,y:.5}}),false,'Large sideways nose offset rejects a turned head');
assert.equal(facingMirror({...front,nose:{x:.5,y:.41}}),false,'Reject extreme upward tilt');
assert.equal(facingMirror({...front,nose:{x:.5,y:.65}}),false,'Reject extreme downward tilt');
const angle=.6,rotate=p=>({x:.5+(p.x-.5)*Math.cos(angle)-(p.y-.4)*Math.sin(angle),y:.4+(p.x-.5)*Math.sin(angle)+(p.y-.4)*Math.cos(angle)});
assert.equal(facingMirror({...front,eyes:front.eyes.map(rotate),nose:rotate(front.nose)}),true,'Normal head roll is allowed');
for(const sourceRatio of [.75,4/3])for(const viewRatio of [.75,4/3,1]){
 assert.equal(facingMirror(faceToMirror(front,sourceRatio,viewRatio),viewRatio),true,'Head-facing judgement survives mirroring and display cropping');
 assert.equal(facingMirror(faceToMirror({...front,nose:{x:.58,y:.5}},sourceRatio,viewRatio),viewRatio),false);
}
for(const face of [null,{}, {...front,nose:null},{...front,nose:{x:NaN,y:.5}},{...front,eyes:[front.eyes[0],front.eyes[0]]}])assert.equal(facingMirror(face),false);
console.log('PASS: broad head-facing check, side/up/down rejection, roll tolerance, aspect/crop invariance and missing landmarks');
let worker,resolveBitmap;const messages=[];globalThis.Worker=class{constructor(){worker=this}postMessage(data){messages.push(data)}};
globalThis.createImageBitmap=()=>new Promise(resolve=>{resolveBitmap=resolve});
const received=[],tracker=new FaceTracker(data=>received.push(data));worker.onmessage({data:{type:'ready',backend:'test'}});await tracker.ready;
const mapping={region:{x:0,y:0,width:1280,height:960},sourceWidth:1280,sourceHeight:960};
const first=tracker.submit({width:320,height:240},100,3,mapping);await tracker.submit({},101,3);assert.equal(messages.length,1,'A frame in flight cannot create an inference queue');
resolveBitmap({});await first;assert.equal(messages.length,2);assert.equal(messages[1].epoch,3);assert.equal(tracker.busy,true);
worker.onmessage({data:{type:'result',faces:[]}});assert.equal(tracker.busy,false);assert.equal(received.length,1);assert.equal(received[0].mapping,mapping,'Result retains geometry from its own scan, not a later framing update');
console.log('PASS: full-camera crop/mirror eye mapping; one frame in flight, no inference queue');

const outlines={...visible,eyeBounds:[{left:-.01,right:.1,top:.3,bottom:.4},{left:.5,right:.6,top:.3,bottom:.4}]};
assert.equal(bothEyesVisible(outlines),false,'Eye centres alone cannot pass a clipped eye outline');
outlines.eyeBounds[0].left=.01;assert.equal(bothEyesVisible(outlines),true);
assert.equal(bothEyesVisible(outlines,p=>({...p,x:p.x+.45})),false,'Warped eye corners must also stay on screen');
console.log('PASS: complete eye outlines are required, including after the live warp');
