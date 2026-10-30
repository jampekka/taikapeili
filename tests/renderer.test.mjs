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
// Regression: sequence/cancellation must not switch live morph power.
const powers=[];
const live={source:{width:640,height:800},canvas:{width:0,height:0,getBoundingClientRect:()=>({width:640,height:800})},strength:.7,reduced:false,drawCPU(...args){powers.push(args[5])}};
for(const waiting of [false,true,false]){live.waiting=waiting;MirrorRenderer.prototype.draw.call(live,1000)}
assert.deepEqual(powers,[.025*.7,.025*.7,.025*.7],'A sequence waiting flag cannot affect live morph intensity');
let speech=1;live.voiceLevel=()=>speech;
for(let i=0;i<20;i++)MirrorRenderer.prototype.draw.call(live,1100+i*33);
assert.ok(powers.at(-1)>.025*.7&&powers.at(-1)<=.025*.7*1.3,'Speech gently increases the existing warp within a fixed bound');
assert.equal(live.strength,.7,'Speaking never edits the saved morph strength');assert.equal(live.liveView.power,powers.at(-1),'Eye projection follows the actual speaking warp');
speech=0;for(let i=0;i<40;i++)MirrorRenderer.prototype.draw.call(live,1800+i*33);
assert.ok(Math.abs(powers.at(-1)-.025*.7)<1e-8,'Silence settles back to base warp');
speech=1;live.reduced=true;MirrorRenderer.prototype.draw.call(live,3200);assert.equal(powers.at(-1),.006*.7,'Reduced motion disables the extra speaking pulse');
const realRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>1;
try{
 const calls=[],underlay={running:true,gl:null,lastDraw:0,scareImage:{},until:750,draw(now){calls.push(['live',now])},drawReveal(now){calls.push(['reveal',now])},clearReveal(){this.scareImage=null;calls.push(['clear'])},onTick(){},tick(){}};
 MirrorRenderer.prototype.tick.call(underlay,100);assert.deepEqual(calls,[['live',100],['reveal',100]],'Live animation must update under the reveal overlay');
 calls.length=0;MirrorRenderer.prototype.tick.call(underlay,800);assert.deepEqual(calls,[['live',800],['clear']],'Uncover the continuously updated live canvas without resetting its clock');
}finally{globalThis.requestAnimationFrame=realRAF}
console.log('PASS: constant live morph power across waiting/cancellation and continuous rendering behind reveal');
