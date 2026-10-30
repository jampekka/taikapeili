// A small deterministic controller keeps detection, rendering and camera I/O separate.
export class MirrorCycle {
 constructor(){this.reset()}
 reset(){this.phase='live';this.lastFace=null;this.stableSince=null;this.lastSeen=-Infinity;this.nextCapture=0;this.showUntil=0;this.ticket=(this.ticket||0)+1}
 observe(face,now){
  let hide=false;
  if(!face){
   this.stableSince=null;
   if(now-this.lastSeen>650){hide=this.phase!=='live';this.phase='live';this.ticket++;this.lastFace=null;this.nextCapture=0}
   return {hide,capture:false};
  }
  this.lastSeen=now;
  const prior=this.lastFace;
  const moved=prior&&(Math.hypot(face.center.x-prior.center.x,face.center.y-prior.center.y)>.1||Math.abs(Math.log(face.width/prior.width))>.25);
  if(moved){hide=this.phase!=='live';this.phase='live';this.ticket++;this.stableSince=now;this.nextCapture=0}
  if(this.stableSince===null)this.stableSince=now;
  this.lastFace=face;
  if(this.phase==='reveal'&&now>=this.showUntil){this.phase='live';hide=true;this.nextCapture=now+6500}
  if(this.phase==='live'&&now>=this.nextCapture&&now-this.stableSince>=1000){this.phase='processing';this.ticket++;return {hide,capture:true,ticket:this.ticket}}
  return {hide,capture:false};
 }
 complete(ticket,now){if(ticket!==this.ticket||this.phase!=='processing'||now-this.lastSeen>650)return false;this.phase='reveal';this.showUntil=now+1700;return true}
 fail(ticket,now){if(ticket===this.ticket){this.phase='live';this.nextCapture=now+3000}}
}
