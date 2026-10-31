import assert from 'node:assert/strict';
import {cameraCrop,frameEyes} from '../assets/camera-view.js';
import {faceToMirror} from '../assets/tracker.js';
for(const [w,h] of [[1280,960],[960,1280]])for(const aspect of [.6,1,1.5])for(const cameraZoom of [1,1.5,3])for(const cameraPanX of [-1,0,1])for(const cameraPanY of [-1,0,1]){
 const r=cameraCrop(w,h,aspect,{cameraZoom,cameraPanX,cameraPanY});
 assert.ok(r.x>=-1e-8&&r.y>=-1e-8&&r.x+r.width<=w+1e-8&&r.y+r.height<=h+1e-8,'Every pan/zoom remains filled');
 assert.ok(Math.abs(r.width/r.height-aspect)<1e-9);
 // An eye at a known raw pixel must land at the same displayed coordinate
 // when the shared crop is scanned, mirrored, or used for the final portrait.
 const raw={x:r.x+r.width*.25,y:r.y+r.height*.3},p={x:(raw.x-r.x)/r.width,y:(raw.y-r.y)/r.height};
 const face=faceToMirror({center:p,width:.1,height:.2,eyes:[p,{x:p.x+.1,y:p.y}]},aspect,aspect);
 assert.ok(Math.abs(face.center.x-.75)<1e-9&&Math.abs(face.center.y-.3)<1e-9);
}
const crop=cameraCrop(1000,1000,1,{cameraZoom:2});
const eyes=[{x:.4,y:.5},{x:.6,y:.5}],pan=frameEyes(crop,1000,1000,eyes),aligned=cameraCrop(1000,1000,1,{cameraZoom:2,...pan});
assert.ok(Math.abs((500-aligned.y)/aligned.height-.18)<1e-9,'Eye framing places the eye line near the camera');
assert.equal(frameEyes(crop,1000,1000,null),null);
assert.deepEqual(cameraCrop(1000,1000,1),{x:0,y:0,width:1000,height:1000});
console.log('PASS: crop bounds, display/detection/capture alignment, eye-line framing, and reset');
