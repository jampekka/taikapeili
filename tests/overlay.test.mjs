import assert from 'node:assert/strict';
import {projectLivePoint,sampleLivePoint,ripplePoint} from '../assets/overlay.js';
const packets=[[.27,.012],[.61,.009],[1.1,.005]];
for(const cover of [[1,1],[.55,1],[1,.65]])for(const power of [0,.0175,.025])for(const ripples of [[],packets])for(const point of [{x:.2,y:.2},{x:.5,y:.4},{x:.8,y:.8}])for(const flipY of [false,true]){
 const view={cover,power,time:3.4,aspect:.75,ripples,flipY},p=projectLivePoint(point,view);
 const q=sampleLivePoint({x:p.x,y:flipY?1-p.y:p.y},view),target={x:1-((point.x-.5)*cover[0]+.5),y:((flipY?1-point.y:point.y)-.5)*cover[1]+.5};
 assert.ok(Math.abs(q.x-target.x)<.0001&&Math.abs(q.y-target.y)<.0001,'Overlay follows combined base warp and voice rings across crops and vertical origins');
}
for(const aspect of [.6,1,1.5]){
 const view={aspect,ripples:packets};
 for(const p of [{x:0,y:.3},{x:1,y:.7},{x:.2,y:0},{x:.8,y:1},{x:.5,y:.5}])assert.deepEqual(ripplePoint(p,view),p,'Voice fixes edges and centre');
 const horizontal=ripplePoint({x:.5+.2/aspect,y:.5},view),vertical=ripplePoint({x:.5,y:.7},view);
 // Compare with the edge taper removed: equal screen distance has the same phase.
 assert.equal(Math.sign(horizontal.x-(.5+.2/aspect)),Math.sign(vertical.y-.7),'Portrait correction keeps ring phases circular');
}
const displacement=(radius,age)=>ripplePoint({x:.5+radius,y:.5},{ripples:[[age,.015]]}).x-(.5+radius);
assert.ok(displacement(.15,.4)*displacement(.23,.4)<0,'A pond ring has alternating refraction bands');
assert.ok(Math.abs(displacement(.15,.4))>Math.abs(displacement(.15,1.2))*10,'Wave packet leaves the centre as its front travels out');
const p={x:.6,y:.6},base={power:.0175,time:2};
assert.notDeepEqual(sampleLivePoint(p,base,-1),sampleLivePoint(p,base,1),'RGB channels break apart without speech');
assert.notDeepEqual(sampleLivePoint(p,base),sampleLivePoint(p,{...base,time:3}),'Base morph keeps moving in silence');
console.log('PASS: combined overlay alignment, circular travelling rings, fixed edges and continuous RGB morph');
