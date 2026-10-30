const FILES={scare:'scream.mp3',come:'come-closer.mp3',look:'look-deeper.mp3'};
export class HorrorAudio {
 constructor(){this.context=null;this.output=null;this.voices=[];this.volume=.65;this.last='none';this.raw=new Map();this.buffers=new Map();this.preload()}
 get status(){if(!this.context)return 'locked';return this.context.state==='running'&&!this.buffers.size?'loading samples':this.context.state}
 async preload(){if(this.loading)return this.loading;this.loading=Promise.allSettled(Object.entries(FILES).map(async([id,path])=>{const response=await fetch('./audio/'+path);if(!response.ok)throw new Error('Audio sample unavailable');this.raw.set(id,await response.arrayBuffer())}));return this.loading}
 async unlock(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
  if(!this.context){this.context=new Audio();const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=10;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;this.output=this.context.createGain();this.output.gain.value=this.volume*.8;this.output.connect(limiter);limiter.connect(this.context.destination)}
  await this.context.resume();await this.preload();if(!this.decoding)this.decoding=Promise.allSettled([...this.raw].map(async([id,bytes])=>this.buffers.set(id,await this.context.decodeAudioData(bytes.slice(0)))));await this.decoding;return this.context.state==='running';
 }
 duration(id,fallback=3){return this.buffers.get(id)?.duration||fallback}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.output)this.output.gain.setTargetAtTime(this.volume*.8,this.context.currentTime,.02)}
 stop(group){for(const voice of this.voices){if(!group||voice.group===group){try{voice.node.stop()}catch{}}}this.voices=this.voices.filter(v=>group&&v.group!==group)}
 playSample(id,group='scare',gain=1){if(this.context?.state!=='running')return 'locked';const buffer=this.buffers.get(id);if(!buffer)return 'samples loading';this.stop(group);const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;level.gain.value=gain;source.connect(level);level.connect(this.output);source.start();source.onended=()=>{source.disconnect();level.disconnect();this.voices=this.voices.filter(v=>v.node!==source)};this.voices.push({node:source,group});return id}
 say(id){return this.playSample(id,'whisper',.85)}
 play(){this.stop('whisper');return this.playSample('scare','scare',1)}
}
