import assert from 'node:assert/strict';
import {projectLivePoint,sampleLivePoint} from '../assets/overlay.js';
for(const cover of [[1,1],[.55,1],[1,.65]])for(const time of [0,3,10])for(const power of [0,.0175,.035])for(const point of [{x:.2,y:.2},{x:.5,y:.4},{x:.8,y:.8}]){
 const options={cover,time,power},p=projectLivePoint(point,options),q=sampleLivePoint(p,options);
 const target={x:1-((point.x-.5)*cover[0]+.5),y:(point.y-.5)*cover[1]+.5};
 assert.ok(Math.abs(q.x-target.x)<.0001&&Math.abs(q.y-target.y)<.0001,'Overlay follows the green-channel warp across crops/times');
 if(power===0){assert.ok(Math.abs(p.x-point.x)<1e-9&&Math.abs(p.y-point.y)<1e-9)}
}
console.log('PASS: overlay and live morph use the same camera crop/warp; zero warp is identity');
