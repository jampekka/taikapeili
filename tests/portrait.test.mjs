import assert from 'node:assert/strict';
import {eyeGeometry,revealZoom} from '../assets/portrait.js';
const f={eyes:[{x:.3,y:.4},{x:.7,y:.5}],center:{x:.5,y:.5},width:.5,height:.6};
const g=eyeGeometry(f,800,1000);
const transform=p=>{const dx=p.x-g.mid.x,dy=p.y-g.mid.y;return {x:Math.cos(-g.angle)*dx-Math.sin(-g.angle)*dy,y:Math.sin(-g.angle)*dx+Math.cos(-g.angle)*dy}};
const eyes=g.eyes.map(transform);assert.ok(Math.abs(eyes[0].y-eyes[1].y)<1e-9,'Rotation levels both measured eyes');
assert.ok(revealZoom(0)<.05);assert.ok(revealZoom(60)>1.2);assert.equal(revealZoom(650),1.6);assert.equal(revealZoom(0,true),revealZoom(650,true));
console.log('PASS: measured eyes level under transform; aggressive 60ms zoom, no oscillation; reduced-motion static');
