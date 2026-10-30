import assert from 'node:assert/strict';
import {summarizeMask} from '../assets/presence.js';
const mask={width:20,height:20,data:new Uint8Array(400)};
assert.equal(summarizeMask(mask).present,false);
for(let y=4;y<19;y++)for(let x=5;x<15;x++)mask.data[y*20+x]=1;
const person=summarizeMask(mask);assert.equal(person.present,true);assert.equal(person.coverage,.375);assert.deepEqual(person.bounds,{x:.25,y:.2,width:.5,height:.75});
const speck={width:20,height:20,data:new Uint8Array(400)};speck.data[2]=1;assert.equal(summarizeMask(speck).present,false);
console.log('PASS: snapshot foreground coverage/bounds, blank mask and tiny-speck rejection');
