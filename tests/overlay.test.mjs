import assert from 'node:assert/strict';
import {projectLivePoint,sampleLivePoint,centralScale} from '../assets/overlay.js';
for(const cover of [[1,1],[.55,1],[1,.65]])for(const bulge of [-.2,0,.2])for(const point of [{x:.2,y:.2},{x:.5,y:.4},{x:.8,y:.8}]){
 const options={cover,bulge},p=projectLivePoint(point,options),q=sampleLivePoint(p,options);
 const target={x:1-((point.x-.5)*cover[0]+.5),y:(point.y-.5)*cover[1]+.5};
 assert.ok(Math.abs(q.x-target.x)<.0001&&Math.abs(q.y-target.y)<.0001,'Overlay follows the Gaussian lens across crops and positive/negative deformation');
 if(bulge===0){assert.ok(Math.abs(p.x-point.x)<1e-9&&Math.abs(p.y-point.y)<1e-9)}
}
console.log('PASS: overlay and live morph use the same camera crop/warp; zero lens is identity');
for(const cover of [[1,1],[.55,1],[1,.65]])for(const bulge of [-.2,0,.2])for(const point of [{x:.2,y:.2},{x:.5,y:.4},{x:.8,y:.8}]){
 const view={cover,bulge,flipY:true},p=projectLivePoint(point,view);
 const q=sampleLivePoint({x:p.x,y:1-p.y},view),target={x:1-((point.x-.5)*cover[0]+.5),y:((1-point.y)-.5)*cover[1]+.5};
 assert.ok(Math.abs(q.x-target.x)<.0001&&Math.abs(q.y-target.y)<.0001,'WebGL bottom-origin sampling maps back to top-origin screen eyes without a vertical offset');
}
console.log('PASS: WebGL vertical-axis conversion across crops and eye heights');

for(const bulge of [-.2,.2]){
 for(const p of [{x:0,y:.3},{x:1,y:.7},{x:.2,y:0},{x:.8,y:1}])assert.equal(centralScale(p.x,p.y,bulge),1,'Lens leaves the edges fixed');
 let previous=Infinity;for(let x=.5;x<=1;x+=.01){const weight=Math.abs(centralScale(x,.5,bulge)-1);assert.ok(weight<=previous+1e-12,'Central Gaussian influence falls smoothly without ripple rings');previous=weight}
}
assert.ok(projectLivePoint({x:.6,y:.5},{bulge:.2}).x>.6,'Positive lens swells the central image');
assert.ok(projectLivePoint({x:.6,y:.5},{bulge:-.2}).x<.6,'Negative lens pinches the central image');
console.log('PASS: smooth central Gaussian falloff, fixed edges, positive swell and negative pinch');
