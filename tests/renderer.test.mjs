import assert from 'node:assert/strict';
import {MirrorRenderer} from '../assets/renderer.js';
const w=64,h=80;
let output;
const ctx={clearRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(w*h*4).fill(255)}},createImageData(){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(value){output=value.data}};
const renderer={scratch:{width:w,height:h},sctx:ctx,ctx:{drawImage(){}}},image={width:w,height:h};
for(const cover of [[1,1],[.6,1],[1,.6]])for(const time of [0,1,3,12,60]){
 MirrorRenderer.prototype.drawCPU.call(renderer,image,w,h,cover,1,.15,time,true);
 assert.ok(output.every(v=>v===255),'Live warp must not introduce black pixels, including at the edges');
}
MirrorRenderer.prototype.drawCPU.call(renderer,image,w,h,[1,1],.1,.065,1,false);
assert.equal(output[0],0,'Reveal zoom must retain its intentional black surround');
assert.equal(output[((40*w)+32)*4],255,'Reveal centre must remain visible');
console.log('PASS: live warp stays filled across times/aspect ratios; reveal retains black surround');
