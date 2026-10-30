import assert from 'node:assert/strict';
import {transformSnapshot} from '../assets/effects.js';
const calls=[];const ctx={drawImage(...args){calls.push(['image',...args])},fillRect(){},save(){},restore(){},translate(x,y){calls.push(['eye',x,y])},scale(){},createRadialGradient(){return {addColorStop(){}}},beginPath(){},ellipse(){},fill(){},getImageData(){assert.fail('Dummy must not read or loop over image pixels')}};
globalThis.document={createElement(){return {getContext(){return ctx}}}};
const image={width:640,height:800},result=transformSnapshot({image,face:{eyes:[{x:.3,y:.4},{x:.6,y:.4}]}});
assert.equal(result.width,640);assert.equal(result.height,800);assert.deepEqual(calls,[['image',image,0,0],['eye',192,320],['eye',384,320]],'Keep the complete image; place only eye effects, without masking or rotation crop');
console.log('PASS: complete snapshot, measured eyes, only canvas drawing, no pixel readback');
