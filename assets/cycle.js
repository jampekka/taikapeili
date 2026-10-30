export class MirrorCycle {
 constructor(){this.reset()}
 reset(){this.phase='live';this.lastFace=null;this.lastSeen=-Infinity;this.nextCapture=0;this.showUntil=0;this.ticket=(this.ticket||0)+1}
 observe(face,now){
  let hide=false;
  if(!face){if(now-this.lastSeen>1000){hide=this.phase!=='live';this.phase='live';this.ticket++;this.lastFace=null;this.nextCapture=0}return {hide,capture:false}}
  this.lastSeen=now;
  // Cancel a clearly different position, but allow ordinary movement during a model request.
  const prior=this.lastFace;
  const jumped=prior&&(Math.hypot(face.center.x-prior.center.x,face.center.y-prior.center.y)>.35||Math.abs(Math.log(face.width/prior.width))>.8);
  if(jumped&&this.phase!=='reveal'){hide=this.phase!=='live';this.phase='live';this.ticket++;this.nextCapture=0}
  this.lastFace=face;
  if(this.phase==='reveal'&&now>=this.showUntil){this.phase='live';hide=true;this.nextCapture=now+6000}
  // The first detection triggers immediately: no stable-face wait or countdown.
  if(this.phase==='live'&&now>=this.nextCapture){this.phase='processing';this.ticket++;return {hide,capture:true,ticket:this.ticket}}
  return {hide,capture:false};
 }
 complete(ticket,now){if(ticket!==this.ticket||this.phase!=='processing')return false;this.phase='reveal';this.showUntil=now+1400;return true}
 fail(ticket,now){if(ticket===this.ticket){this.phase='live';this.nextCapture=now+10000}}
}
