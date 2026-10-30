import assert from 'node:assert/strict';
import {eyeGeometry,revealZoom,revealImpact} from '../assets/portrait.js';
const f={eyes:[{x:.3,y:.4},{x:.7,y:.5}],center:{x:.5,y:.5},width:.5,height:.6};
const g=eyeGeometry(f,800,1000);
const transform=p=>{const dx=p.x-g.mid.x,dy=p.y-g.mid.y;return {x:Math.cos(-g.angle)*dx-Math.sin(-g.angle)*dy,y:Math.sin(-g.angle)*dx+Math.cos(-g.angle)*dy}};
const eyes=g.eyes.map(transform);assert.ok(Math.abs(eyes[0].y-eyes[1].y)<1e-9,'Rotation levels both measured eyes');
assert.ok(revealZoom(0)<.05);assert.equal(revealZoom(50),1.8);assert.equal(revealZoom(135),1.5);assert.equal(revealZoom(650),1.65);assert.equal(revealZoom(0,true),revealZoom(650,true));
for(let t=0;t<=650;t++){
 const impact=revealImpact(t),fade=(1-t/650)**2;
 assert.ok(Math.abs(impact.x)<=.022*fade+1e-12);assert.ok(Math.abs(impact.y)<=.017*fade+1e-12);
 assert.ok(impact.brightness>=0&&impact.brightness<.5);
 assert.deepEqual(revealImpact(t,true),{x:0,y:0,brightness:0});
}
for(const t of [65,245,430])assert.ok(revealImpact(t).brightness>.24,'Three distinct brightness surges');
console.log('PASS: measured eyes stay level; 50ms overshoot; bounded decaying shake and brightness; reduced-motion static');
