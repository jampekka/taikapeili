// One owner for the complete capture → sequence/image → reveal lifecycle.
export class MirrorRun {
 constructor(onChange=()=>{}){this.onChange=onChange;this.state='idle';this.active=null;this.error=null}
 setState(state){this.state=state;this.onChange(state,this)}
 start({generate,sequence,beforeReveal=async image=>image,reveal}){
  if(this.state!=='idle')return false;
  const run={controller:new AbortController(),started:performance.now(),imageReady:false,sequenceDone:false};
  this.active=run;this.error=null;this.setState('running');
  const signal=run.controller.signal;
  const image=Promise.resolve().then(()=>generate(signal)).then(value=>{run.imageReady=true;return value});
  const cues=Promise.resolve().then(()=>sequence(signal)).then(()=>{run.sequenceDone=true});
  run.done=Promise.all([image,cues]).then(async([image])=>{
   if(this.active!==run||signal.aborted)return;
   const prepared=await beforeReveal(image,signal);
   if(this.active!==run||signal.aborted)return;
   this.setState('reveal');await reveal(prepared,signal);
   if(this.active===run){this.active=null;this.setState('idle')}
  }).catch(error=>{
   if(this.active!==run)return;
   run.controller.abort();this.active=null;this.error=error;this.setState('error');
  });
  return true;
 }
 reset(){const run=this.active;this.active=null;run?.controller.abort();this.error=null;this.setState('idle')}
}
export function delay(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return}
 const cancel=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve()},ms);
 signal?.addEventListener('abort',cancel,{once:true});
})}
