// One lifecycle owner, including face-loss cancellation and rearming.
export class MirrorRun {
 constructor(onChange=()=>{}){this.onChange=onChange;this.state='idle';this.active=null;this.error=null;this.armed=true;this.absentSince=null}
 setState(state){this.state=state;this.onChange(state,this)}
 observeFace(present,now){
  if(present){this.absentSince=null;return}
  if(this.absentSince===null)this.absentSince=now;
  const absentFor=now-this.absentSince;
  if(this.state==='running'&&absentFor>=1000)this.cancel();
  if(absentFor>=3000){this.armed=true;if(this.state==='finished')this.setState('idle')}
 }
 cancel(){const run=this.active;this.active=null;run?.controller.abort();this.setState('finished')}
 start({generate,sequence,beforeReveal=async image=>image,reveal,afterReveal=async()=>{},generateAfterSequence=false}){
  if(this.state!=='idle'||!this.armed)return false;
  this.armed=false;
  const run={controller:new AbortController(),started:performance.now(),imageReady:false,sequenceDone:false,generateAfterSequence};
  this.active=run;this.error=null;this.setState('running');
  const signal=run.controller.signal;
  const cues=Promise.resolve().then(()=>sequence(signal)).then(()=>{run.sequenceDone=true});
  const startImage=()=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError');return generate(signal)};
  const image=(generateAfterSequence?cues.then(startImage):Promise.resolve().then(startImage)).then(value=>{run.imageReady=true;return value});
  run.done=Promise.all([image,cues]).then(async([image])=>{
   if(this.active!==run||signal.aborted)return;
   const prepared=await beforeReveal(image,signal);
   if(this.active!==run||signal.aborted)return;
   this.absentSince=null;this.setState('reveal');await reveal(prepared,signal);
   if(this.active!==run||signal.aborted)return;
   this.setState('after');await afterReveal(signal);
   if(this.active===run){this.active=null;this.setState(this.armed?'idle':'finished')}
  }).catch(error=>{
   if(this.active!==run)return;
   run.controller.abort();this.active=null;this.error=error;this.setState('error');
  });
  return true;
 }
 reset(){const run=this.active;this.active=null;run?.controller.abort();this.error=null;this.armed=true;this.absentSince=null;this.setState('idle')}
}
export function delay(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return}
 const cancel=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve()},ms);
 signal?.addEventListener('abort',cancel,{once:true});
})}
