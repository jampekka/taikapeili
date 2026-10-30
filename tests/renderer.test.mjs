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
// The reveal bypasses the live RGB sampling path completely.
const operations=[];
const revealContext={setTransform(){},fillRect(){operations.push('black')},translate(x,y){operations.push([x,y])},scale(){},drawImage(){operations.push('image')}};
const separate={revealCanvas:{width:640,height:800,hidden:true,getBoundingClientRect:()=>({width:640,height:800})},revealContext,scareImage:{width:640,height:800},focus:{x:.5,y:.4},target:{x:.3,y:.7},scareAt:0,reduced:false};
MirrorRenderer.prototype.drawReveal.call(separate,100);
assert.equal(separate.revealCanvas.hidden,false);assert.deepEqual(operations,['black',[192,560],[-320,-320],'image'],'Latest eye anchor sets the reveal screen position while source eyes retain their captured coordinates');
console.log('PASS: live warp stays filled across times/aspect ratios; separate reveal draws one unwarped image');
