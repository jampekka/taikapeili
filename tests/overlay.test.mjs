import assert from 'node:assert/strict';
import {projectLivePoint,sampleLivePoint,ripplePoint} from '../assets/overlay.js';
import {rippleOrigin,RIPPLE_SOURCE_COUNT} from '../assets/renderer.js';
const packets=[[.27,.0252,.06,.22],[.61,.0252,.94,.74],[1.1,.0252,.04,.75]];
for(const cover of [[1,1],[.55,1],[1,.65]])for(const power of [0,.0175,.025])for(const ripples of [[],packets])for(const point of [{x:.2,y:.2},{x:.5,y:.4},{x:.8,y:.8}])for(const flipY of [false,true]){
 const view={cover,power,time:3.4,aspect:.75,ripples,flipY},p=projectLivePoint(point,view);
 const q=sampleLivePoint({x:p.x,y:flipY?1-p.y:p.y},view),target={x:1-((point.x-.5)*cover[0]+.5),y:((flipY?1-point.y:point.y)-.5)*cover[1]+.5};
 assert.ok(Math.abs(q.x-target.x)<.0001&&Math.abs(q.y-target.y)<.0001,'Overlay follows combined base warp and voice rings across crops and vertical origins');
}
for(const aspect of [.6,1,1.5]){
 const view={aspect,ripples:packets};
 for(const p of [{x:0,y:.3},{x:1,y:.7},{x:.2,y:0},{x:.8,y:1}])assert.deepEqual(ripplePoint(p,view),p,'Voice keeps image edges fixed');
 const single={aspect,ripples:[[.4,.012,.04,.3]]};
 const horizontal=ripplePoint({x:.04+.1/aspect,y:.3},single),vertical=ripplePoint({x:.04,y:.4},single);
 assert.equal(Math.sign(horizontal.x-(.04+.1/aspect)),Math.sign(vertical.y-.4),'Portrait correction keeps ring phases circular around side sources');
 assert.deepEqual(ripplePoint({x:.04,y:.3},single),{x:.04,y:.3},'The source itself stays finite and fixed');
}
const displacement=(radius,age)=>ripplePoint({x:.04+radius,y:.3},{ripples:[[age,.012,.04,.3]]}).x-(.04+radius);
assert.ok(displacement(.15,.4)*displacement(.23,.4)<0,'A side ring has alternating refraction bands');
assert.ok(Math.abs(displacement(.15,.4))>Math.abs(displacement(.15,1.2))*10,'Wave packet travels away from the side source');
const at={x:.18,y:.3},a=ripplePoint(at,{ripples:[packets[0]]}),b=ripplePoint(at,{ripples:[packets[1]]}),both=ripplePoint(at,{ripples:packets.slice(0,2)});
assert.ok(Math.abs(both.x-(a.x+b.x-at.x))<1e-12&&Math.abs(both.y-(a.y+b.y-at.y))<1e-12,'Waves from different sources overlap additively');
const p={x:.6,y:.6},base={power:.0175,time:2};
assert.notDeepEqual(sampleLivePoint(p,base,-1),sampleLivePoint(p,base,1),'RGB channels break apart without speech');
assert.notDeepEqual(sampleLivePoint(p,base),sampleLivePoint(p,{...base,time:3}),'Base morph keeps moving in silence');
console.log('PASS: combined overlay alignment, circular travelling rings, fixed edges and continuous RGB morph');

const voiceOnly={power:0,ripples:packets};
assert.notDeepEqual(sampleLivePoint(at,voiceOnly,-1),sampleLivePoint(at,voiceOnly,1),'Voice ripples split RGB even with the base morph disabled');
for(const channel of [-1,0,1])assert.deepEqual(sampleLivePoint(at,{power:0},channel),sampleLivePoint(at,{power:0}),'Silence adds no ripple RGB offset');
console.log('PASS: stronger side packets retain tracking alignment and add their own RGB breakup');

const sourceView={aspect:.75,sources:[[.04,.3]],speechPower:.455,ripples:[[.2,.084,.04,.3]]};
const near={x:.1,y:.3},bent=ripplePoint(near,sourceView);
assert.ok(Math.abs(bent.x-near.x)>.015,'Local source strongly deforms the image');
for(const x of [.46,.5,.54])assert.deepEqual(ripplePoint({x,y:.5},sourceView),{x,y:.5},'The innermost centre is protected from all voice lenses and waves');
const travel=radius=>{const point={x:.04+radius,y:.3},age=(radius*.75-.04)/.48;return Math.abs(ripplePoint(point,{aspect:.75,ripples:[[age,.084,.04,.3]]}).x-point.x)};
assert.ok(travel(.1)>travel(.25)*3,'Travelling peak still decays with distance and time');
assert.notDeepEqual(sampleLivePoint(near,sourceView,-1),sampleLivePoint(near,sourceView,1),'Local source swell also separates RGB');
console.log('PASS: strong local source response, rapid outward decay and protected centre');

for(const aspect of [.6,1,1.5])for(const x of [.05,.1,.2,.3,.5,.7,.8,.9,.95])for(const y of [.2,.4,.6,.8]){
 const view={aspect,power:.025,time:3,speechPower:.65,sources:Array.from({length:RIPPLE_SOURCE_COUNT},(_,i)=>rippleOrigin(i,3,aspect))},point={x,y},q=sampleLivePoint(projectLivePoint(point,view),view);
 assert.ok(Math.hypot(q.x-(1-x),q.y-y)<.0001,'Tracking aligns even at full local voice strength');
}
console.log('PASS: tracking inverse converges through strong local swells');

assert.ok(travel(.34)>.0001,'Ripples now reach beyond the previous 36% side cutoff');
for(const [originX,originY,x,y] of [[.3,.04,.3,.1],[.7,.96,.7,.9]]){
 const point={x,y},warped=ripplePoint(point,{sources:[[originX,originY]],speechPower:.455});
 assert.ok(Math.hypot(warped.x-x,warped.y-y)>.015,'Top and bottom source swells are as strong as side sources');
}
console.log('PASS: farther propagation and active top/bottom edge sources');

// Preserve the source profile that preceded the four-edge layout, independently of ring reach.
for(const aspect of [.6,1,1.5])for(const x of [.055,.08,.12,.2,.28]){
 const t=Math.max(0,Math.min(1,(x-.12)/.24)),fade=1-t*t*(3-2*t),dx=(x-.04)*aspect,amount=-.455*Math.exp(-Math.pow(dx/(aspect*.16),2))*fade;
 const point={x,y:.5},sourceOnly=ripplePoint(point,{aspect,sources:[[.04,.5]],speechPower:.455});
 assert.ok(Math.abs(sourceOnly.x-(x+dx*amount/aspect))<1e-12,'Local swell matches the earlier source strength and radius at every screen shape');
}
console.log('PASS: earlier local source profile preserved independently of longer wave propagation');
