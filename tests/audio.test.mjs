import assert from 'node:assert/strict';
import {HorrorAudio} from '../assets/audio.js';
import {SCREAMS} from '../assets/screams.js';
const realFetch=globalThis.fetch,realWindow=globalThis.window;
const started=[],startArgs=[],fades=[];
const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(value,time){fades.push([value,time])},linearRampToValueAtTime(value,time){fades.push([value,time])}});
const node=()=>({connect(){},disconnect(){},gain:param()});
class AudioContext {
 constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
 createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}}
 createGain(){return node()}
 async decodeAudioData(bytes){return {duration:1.5,id:new TextDecoder().decode(bytes)}}
 async resume(){this.state='running';this.onstatechange?.()}
 createBufferSource(){const source={...node(),start(...args){started.push(this.buffer.id);startArgs.push(args)},stop(){}};return source}
}
let release,failed=false;
try{
 globalThis.window={AudioContext};
 const gate=new Promise(resolve=>release=resolve);
 globalThis.fetch=async path=>{await gate;return new Response(path)};
 const audio=new HorrorAudio();
 const unlocked=audio.unlock();assert.equal(audio.context.state,'running');assert.equal(audio.status,'loading samples','Running context is not enough: all clips must decode');assert.equal(audio.say('come'),'samples loading');
 release();await unlocked;assert.equal(audio.ready,true);assert.equal(audio.status,'running');assert.equal(audio.say('opening'),'opening');assert.equal(audio.say('here'),'here');assert.equal(audio.say('come'),'come');assert.equal(audio.say('secret'),'secret');assert.equal(audio.say('look'),'look');assert.equal(audio.play(),'scare');assert.equal(audio.laugh(),'laugh');assert.equal(audio.warning(),'warning');assert.equal(audio.warning('secret'),'warningPrivate');assert.equal(started.length,9);
 assert.equal(audio.play(.45),'scare');assert.deepEqual(startArgs.at(-1),[0,0,.45],'Second scare truncates the cached scream to 450 ms');
 assert.deepEqual(fades.slice(-2),[[1,.45-.04],[0,.45]],'Short second scare fades out instead of cutting abruptly');
 assert.equal(audio.play(),'scare');assert.deepEqual(startArgs.at(-1),[],'Normal scare still plays the complete scream');
 for(const [id,sound] of Object.entries(SCREAMS)){assert.equal(audio.play(undefined,id),id);assert.equal(started.at(-1),'./audio/'+sound.file);assert.deepEqual(startArgs.at(-1),[],'Every full selection plays without truncation')}
 assert.equal(audio.play(undefined,'invalid'),'scare');
 audio.context.state='interrupted';audio.context.onstatechange?.();assert.equal(audio.status,'locked');await audio.unlock();assert.equal(audio.say('come'),'come','Resume after interruption retains decoded whispers');
 globalThis.fetch=async path=>new Response(path,{status:!failed&&path.includes('look-deeper')?503:200});
 const retry=new HorrorAudio();await assert.rejects(retry.prepare(),/Audio unavailable/);assert.equal(retry.status,'sample error');failed=true;await retry.unlock();assert.equal(retry.ready,true);assert.equal(retry.say('look'),'look','A failed asset load is retryable');
}finally{globalThis.fetch=realFetch;globalThis.window=realWindow}
console.log('PASS: deferred loading, all-clip readiness, all three whispers, scream, interrupted context resume and failed-clip retry');
