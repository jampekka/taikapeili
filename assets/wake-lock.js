export class ScreenWakeLock {
 constructor(nav=navigator,doc=document,onChange=()=>{}){this.nav=nav;this.doc=doc;this.onChange=onChange;this.lock=null;this.pending=null;this.wanted=false;this.status=nav.wakeLock?'released':'unsupported'}
 setStatus(value){this.status=value;this.onChange(value)}
 acquire(){
  this.wanted=true;
  if(!this.nav.wakeLock){this.setStatus('unsupported');return Promise.resolve(false)}
  if(this.doc.hidden)return Promise.resolve(false);
  if(this.lock&&!this.lock.released)return Promise.resolve(true);
  if(this.pending)return this.pending;
  this.setStatus('requesting');
  this.pending=(async()=>{
   try{
    const lock=await this.nav.wakeLock.request('screen');
    if(!this.wanted||this.doc.hidden){await lock.release();this.setStatus('released');return false}
    this.lock=lock;lock.addEventListener('release',()=>{if(this.lock===lock){this.lock=null;this.setStatus('released')}},{once:true});
    this.setStatus('active');return true;
   }catch{this.setStatus('unavailable');return false}
  })().finally(()=>{this.pending=null});
  return this.pending;
 }
 async release(){
  this.wanted=false;const lock=this.lock;this.lock=null;
  if(lock)try{await lock.release()}catch{}
  if(!this.wanted)this.setStatus(this.nav.wakeLock?'released':'unsupported');
 }
}
