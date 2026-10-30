export class MirrorLeadIn {
 constructor(){this.cancel()}
 begin(owner,now,comeMs=3500,lookMs=4500){this.owner=owner;this.visible=true;this.startedAt=now;this.comeUntil=now+comeMs;this.lookMs=lookMs;this.readyAt=this.comeUntil+lookMs}
 cue(now){if(!this.visible)return null;return now<this.comeUntil?'come':'look'}
 ready(owner,now){return this.owner===owner&&now>=this.readyAt}
 extendSpeech(cue,now,durationMs){if(cue==='come'){this.comeUntil=Math.max(this.comeUntil,now+durationMs+650);this.readyAt=this.comeUntil+this.lookMs}else this.readyAt=Math.max(this.readyAt,now+durationMs+900)}
 finish(){this.visible=false}
 cancel(){this.owner=null;this.visible=false;this.startedAt=0;this.readyAt=Infinity;this.comeUntil=0;this.lookMs=0}
}
