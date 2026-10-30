import assert from 'node:assert/strict';
import {MirrorRenderer} from '../assets/renderer.js';
import {revealImpact} from '../assets/portrait.js';
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
const separate={revealCanvas:{width:640,height:800,hidden:true,getBoundingClientRect(){return this.hidden?{width:0,height:0}:{width:640,height:800}}},revealContext,scareImage:{width:640,height:800},focus:{x:.5,y:.4},target:{x:.3,y:.7},scareAt:0,reduced:false};
MirrorRenderer.prototype.drawReveal.call(separate,245);
const impact=revealImpact(245);
assert.equal(separate.revealCanvas.hidden,false);assert.equal(separate.revealCanvas.height,800,'Reveal must measure its visible viewport, not a hidden zero-height canvas');assert.deepEqual(operations,['black',[640*(.3+impact.x),800*(.7+impact.y)],[-320,-320],'image','image'],'Latest eye anchor receives bounded shake; brightness redraw shares the exact image transform');
assert.equal(revealContext.globalAlpha,1);assert.equal(revealContext.globalCompositeOperation,'source-over','Brightness compositing must reset before the next frame');
operations.length=0;separate.reduced=true;MirrorRenderer.prototype.drawReveal.call(separate,245);assert.deepEqual(operations,['black',[192,560],[-320,-320],'image'],'Reduced motion has no shake or brightness redraw');
console.log('PASS: live warp stays filled across times/aspect ratios; separate reveal draws one unwarped image');
