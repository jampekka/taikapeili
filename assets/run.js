// One lifecycle owner, including face-loss cancellation and rearming.
export class MirrorRun {
 constructor(onChange=()=>{}){this.onChange=onChange;this.state='idle';this.active=null;this.error=null;this.armed=true;this.absentSince=null;this.facePresent=false}
 setState(state){this.state=state;this.onChange(state,this)}
 observeFace(present,now){
  this.facePresent=present;
  if(present){this.absentSince=null;return}
  if(this.absentSince===null)this.absentSince=now;
  const absentFor=now-this.absentSince;
  if((this.state==='approach'||this.state==='running'||this.state==='instruction')&&absentFor>=1000)this.cancel();
  if(absentFor>=3000){this.armed=true;if(this.state==='finished')this.setState('idle')}
 }
 cancel(){const run=this.active;this.active=null;run?.controller.abort();this.setState('finished')}
 start({generate,sequence,approach=null,beforeReveal=async image=>image,reveal,afterReveal=async()=>{},instruction=null,generateAfterSequence=false}){
  if(this.state!=='idle'||!this.armed)return false;
  this.armed=false;
  const run={controller:new AbortController(),started:performance.now(),imageReady:false,sequenceDone:false,generateAfterSequence};
  this.active=run;this.error=null;this.setState(approach?'approach':'running');
  const signal=run.controller.signal;
  const ready=approach?Promise.resolve().then(()=>approach(signal)).then(()=>{
   if(this.active!==run||signal.aborted)throw new DOMException('Cancelled','AbortError');
   this.setState('running');
  }):Promise.resolve();
  const cues=ready.then(()=>sequence(signal)).then(()=>{run.sequenceDone=true});
  const startImage=()=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError');return generate(signal)};
  const image=(generateAfterSequence?cues.then(startImage):ready.then(startImage)).then(value=>{run.imageReady=true;return value});
  run.done=Promise.all([image,cues]).then(async([image])=>{
   if(this.active!==run||signal.aborted)return;
   const prepared=await beforeReveal(image,signal);
   if(this.active!==run||signal.aborted)return;
   this.absentSince=null;this.setState('reveal');await reveal(prepared,signal);
   if(this.active!==run||signal.aborted)return;
   this.setState('after');await afterReveal(signal);
   if(this.active!==run||signal.aborted)return;
   if(instruction&&this.facePresent){this.setState('instruction');await instruction(signal)}
   if(this.active===run){this.active=null;this.setState(this.armed?'idle':'finished')}
  }).catch(error=>{
   if(this.active!==run)return;
   run.controller.abort();this.active=null;this.error=error;this.setState('error');
  });
  return true;
 }
 reset(){const run=this.active;this.active=null;run?.controller.abort();this.error=null;this.armed=true;this.absentSince=null;this.facePresent=false;this.setState('idle')}
}
export function delay(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return}
 const cancel=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve()},ms);
 signal?.addEventListener('abort',cancel,{once:true});
})}
