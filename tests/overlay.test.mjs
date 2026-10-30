import assert from 'node:assert/strict';
import {projectLivePoint,sampleLivePoint,ripplePoint} from '../assets/overlay.js';
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
 const horizontal=ripplePoint({x:.04+.2/aspect,y:.3},single),vertical=ripplePoint({x:.04,y:.5},single);
 assert.equal(Math.sign(horizontal.x-(.04+.2/aspect)),Math.sign(vertical.y-.5),'Portrait correction keeps ring phases circular around side sources');
 assert.deepEqual(ripplePoint({x:.04,y:.3},single),{x:.04,y:.3},'The source itself stays finite and fixed');
}
const displacement=(radius,age)=>ripplePoint({x:.04+radius,y:.3},{ripples:[[age,.012,.04,.3]]}).x-(.04+radius);
assert.ok(displacement(.15,.4)*displacement(.23,.4)<0,'A side ring has alternating refraction bands');
assert.ok(Math.abs(displacement(.15,.4))>Math.abs(displacement(.15,1.2))*10,'Wave packet travels away from the side source');
const at={x:.45,y:.4},a=ripplePoint(at,{ripples:[packets[0]]}),b=ripplePoint(at,{ripples:[packets[1]]}),both=ripplePoint(at,{ripples:packets.slice(0,2)});
assert.ok(Math.abs(both.x-(a.x+b.x-at.x))<1e-12&&Math.abs(both.y-(a.y+b.y-at.y))<1e-12,'Waves from different sources overlap additively');
const p={x:.6,y:.6},base={power:.0175,time:2};
assert.notDeepEqual(sampleLivePoint(p,base,-1),sampleLivePoint(p,base,1),'RGB channels break apart without speech');
assert.notDeepEqual(sampleLivePoint(p,base),sampleLivePoint(p,{...base,time:3}),'Base morph keeps moving in silence');
console.log('PASS: combined overlay alignment, circular travelling rings, fixed edges and continuous RGB morph');

const voiceOnly={power:0,ripples:packets};
assert.notDeepEqual(sampleLivePoint(at,voiceOnly,-1),sampleLivePoint(at,voiceOnly,1),'Voice ripples split RGB even with the base morph disabled');
for(const channel of [-1,0,1])assert.deepEqual(sampleLivePoint(at,{power:0},channel),sampleLivePoint(at,{power:0}),'Silence adds no ripple RGB offset');
console.log('PASS: stronger side packets retain tracking alignment and add their own RGB breakup');
