export class HorrorAudio {
 constructor(){this.context=null;this.output=null;this.voices=[];this.volume=.65;this.last='none'}
 get status(){return this.context?.state||'locked'}
 async unlock(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
  if(!this.context){this.context=new Audio();const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.14;this.output=this.context.createGain();this.output.gain.value=this.volume*.55;this.output.connect(limiter);limiter.connect(this.context.destination);const n=Math.ceil(this.context.sampleRate*1.5);this.noise=this.context.createBuffer(1,n,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<n;i++)data[i]=Math.random()*2-1}
  await this.context.resume();const silent=this.context.createBufferSource();silent.buffer=this.context.createBuffer(1,1,this.context.sampleRate);silent.connect(this.output);silent.start();return this.context.state==='running';
 }
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.output)this.output.gain.setTargetAtTime(this.volume*.55,this.context.currentTime,.02)}
 stop(){for(const node of this.voices){try{node.stop()}catch{}}this.voices=[]}
 play(choice='random'){
  if(this.context?.state!=='running')return 'locked';this.stop();
  const variants=['shriek','sting','growl'];const pool=variants.filter(v=>v!==this.last);const sound=variants.includes(choice)?choice:pool[Math.floor(Math.random()*pool.length)];this.last=sound;
  const ctx=this.context,t=ctx.currentTime+.008;
  const envelope=(duration,level=.5)=>{const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.009);g.gain.exponentialRampToValueAtTime(.001,t+duration);g.connect(this.output);setTimeout(()=>g.disconnect(),(duration+.2)*1000);return g};
  const tone=(frequency,end,type,duration,target)=>{const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);o.connect(target);o.start(t);o.stop(t+duration);o.onended=()=>o.disconnect();this.voices.push(o);return o};
  const noise=(duration,frequency,q,target)=>{const n=ctx.createBufferSource();n.buffer=this.noise;const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;n.connect(filter);filter.connect(target);n.start(t);n.stop(t+duration);n.onended=()=>{n.disconnect();filter.disconnect()};this.voices.push(n)};
  if(sound==='shriek'){
   // Two falling formants and fast vibrato give a synthetic horror scream.
   const e=envelope(1.1,.37);const formant=ctx.createBiquadFilter();formant.type='bandpass';formant.frequency.setValueAtTime(2100,t);formant.frequency.exponentialRampToValueAtTime(900,t+1.05);formant.Q.value=1.4;formant.connect(e);
   const a=tone(860,280,'sawtooth',1.1,formant),b=tone(1130,370,'sawtooth',1.05,formant);const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=38;depth.gain.value=60;lfo.connect(depth);depth.connect(a.frequency);depth.connect(b.frequency);lfo.start(t);lfo.stop(t+1.1);this.voices.push(lfo);noise(.75,2400,.6,envelope(.75,.25));
  }else if(sound==='sting'){
   const e=envelope(.85,.17);for(const f of [87,94,174,188,355,1420])tone(f,f*.72,'sawtooth',.85,e);noise(.55,3600,.45,envelope(.55,.55));tone(54,28,'sine',.8,envelope(.8,.9));
  }else{
   const e=envelope(1.25,.4);const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(1800,t);filter.frequency.exponentialRampToValueAtTime(180,t+1.2);filter.connect(e);tone(145,37,'sawtooth',1.25,filter);tone(151,42,'sawtooth',1.2,filter);noise(1.1,550,.8,envelope(1.1,.55));tone(48,25,'sine',1.15,envelope(1.15,.75));
  }
  return sound;
 }
}
