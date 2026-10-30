import assert from 'node:assert/strict';
import {revealZoom,revealImpact} from '../assets/portrait.js';
assert.ok(revealZoom(0)<.05);assert.equal(revealZoom(50),1.8);assert.equal(revealZoom(135),1.5);assert.equal(revealZoom(650),1.65);assert.equal(revealZoom(0,true),revealZoom(650,true));
for(let t=0;t<=650;t++){
 const impact=revealImpact(t),fade=(1-t/650)**2;
 assert.ok(Math.abs(impact.x)<=.022*fade+1e-12);assert.ok(Math.abs(impact.y)<=.017*fade+1e-12);
 assert.ok(impact.brightness>=0&&impact.brightness<=.9);
 assert.deepEqual(revealImpact(t,true),{x:0,y:0,brightness:0});
}
for(const t of [65,245,430])assert.ok(revealImpact(t).brightness>.24,'Three distinct brightness surges');
console.log('PASS: 50ms overshoot; bounded decaying shake and brightness; reduced-motion static');
