const FILES={scare:'scream.mp3',come:'come-closer.mp3',secret:'secret.mp3',look:'look-deeper.mp3',laugh:'nelson-haha.mp3'};
export class HorrorAudio {
 constructor(){this.context=null;this.output=null;this.voices=[];this.volume=.65;this.buffers=new Map();this.error=null;this.onStateChange=()=>{};this.prepare().catch(()=>{})}
 get ready(){return Object.keys(FILES).every(id=>this.buffers.has(id))}
 get status(){if(this.error)return 'sample error';if(!this.context||this.context.state!=='running')return 'locked';return this.ready?'running':'loading samples'}
 init(){
  if(this.context)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Web Audio unavailable');
  this.context=new Audio();this.context.onstatechange=()=>this.onStateChange();
  const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=10;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;
  this.output=this.context.createGain();this.output.gain.value=this.volume*.8;this.output.connect(limiter);limiter.connect(this.context.destination);
 }
 prepare(){
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   this.init();this.error=null;
   await Promise.all(Object.entries(FILES).map(async([id,path])=>{
    if(this.buffers.has(id))return;
    const response=await fetch('./audio/'+path);if(!response.ok)throw new Error(`Audio unavailable: ${path}`);
    const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(id,buffer);
   }));
   this.onStateChange();return true;
  })().catch(error=>{this.error=error;this.onStateChange();throw error}).finally(()=>{this.preparing=null});
  return this.preparing;
 }
 async unlock(){
  this.init();
  // resume() must be invoked directly inside the gesture, before awaiting downloads.
  const resumed=this.context.resume();await Promise.all([resumed,this.prepare()]);
  this.onStateChange();return this.status==='running';
 }
 duration(id,fallback=3){return this.buffers.get(id)?.duration||fallback}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.output)this.output.gain.setTargetAtTime(this.volume*.8,this.context.currentTime,.02)}
 stop(group){for(const voice of this.voices)if(!group||voice.group===group){try{voice.node.stop()}catch{}}this.voices=this.voices.filter(v=>group&&v.group!==group)}
 playSample(id,group='scare',gain=1){
  if(this.context?.state!=='running')return 'locked';
  const buffer=this.buffers.get(id);if(!buffer)return this.error?'sample error':'samples loading';
  this.stop(group);const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;level.gain.value=gain;source.connect(level);level.connect(this.output);source.start();
  source.onended=()=>{source.disconnect();level.disconnect();this.voices=this.voices.filter(v=>v.node!==source)};this.voices.push({node:source,group});return id;
 }
 laugh(){return this.playSample('laugh','laugh',.85)}
 say(id){return this.playSample(id,'whisper',.85)}
 play(){this.stop('whisper');return this.playSample('scare','scare',1)}
}
