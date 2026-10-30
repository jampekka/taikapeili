import assert from 'node:assert/strict';
import {HorrorAudio} from '../assets/audio.js';
const realFetch=globalThis.fetch,realWindow=globalThis.window;
const started=[];
const param=()=>({value:0,setTargetAtTime(){}});
const node=()=>({connect(){},disconnect(){},gain:param()});
class AudioContext {
 constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
 createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}}
 createGain(){return node()}
 async decodeAudioData(bytes){return {duration:1.5,id:new TextDecoder().decode(bytes)}}
 async resume(){this.state='running';this.onstatechange?.()}
 createBufferSource(){const source={...node(),start(){started.push(this.buffer.id)},stop(){}};return source}
}
let release,failed=false;
try{
 globalThis.window={AudioContext};
 const gate=new Promise(resolve=>release=resolve);
 globalThis.fetch=async path=>{await gate;return new Response(path)};
 const audio=new HorrorAudio();
 const unlocked=audio.unlock();assert.equal(audio.context.state,'running');assert.equal(audio.status,'loading samples','Running context is not enough: all clips must decode');assert.equal(audio.say('come'),'samples loading');
 release();await unlocked;assert.equal(audio.ready,true);assert.equal(audio.status,'running');assert.equal(audio.say('come'),'come');assert.equal(audio.say('secret'),'secret');assert.equal(audio.say('look'),'look');assert.equal(audio.play(),'scare');assert.equal(audio.laugh(),'laugh');assert.equal(audio.warning(),'warning');assert.equal(started.length,6);
 audio.context.state='interrupted';audio.context.onstatechange?.();assert.equal(audio.status,'locked');await audio.unlock();assert.equal(audio.say('come'),'come','Resume after interruption retains decoded whispers');
 globalThis.fetch=async path=>new Response(path,{status:!failed&&path.includes('look-deeper')?503:200});
 const retry=new HorrorAudio();await assert.rejects(retry.prepare(),/Audio unavailable/);assert.equal(retry.status,'sample error');failed=true;await retry.unlock();assert.equal(retry.ready,true);assert.equal(retry.say('look'),'look','A failed asset load is retryable');
}finally{globalThis.fetch=realFetch;globalThis.window=realWindow}
console.log('PASS: deferred loading, all-clip readiness, all three whispers, scream, interrupted context resume and failed-clip retry');
