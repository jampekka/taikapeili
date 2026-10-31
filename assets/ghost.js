export const GHOST_CONTROLS=[
 {key:'ghostOpacity',label:'Ghost opacity',min:0,max:1,value:.6},
 {key:'ghostSize',label:'Ghost size',min:.4,max:1.3,value:.95}
];

// Keep the apparition out of detection/capture and out of both scare blackouts.
export function ghostVisible(state,hasCue,preview=false){
 if(state==='reveal'||state==='after'||state==='error'||state==='finished')return false;
 return preview||state==='running'||state==='instruction'||state==='approach'&&hasCue;
}
export function ghostLayout(width,height,size=.95){
 const h=Math.min(height*size,width*.9/.8),w=h*.8;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}

export class GhostOverlay {
 constructor(canvas,{reduced=false}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reduced=reduced;
  this.opacity=0;this.lastAt=null;this.lastDraw=-Infinity;this.target=null;this.playing=false;
  this.image=new Image();this.image.src='ghost/sheet-ghost.png';
  this.video=document.createElement('video');this.video.muted=true;this.video.defaultMuted=true;
  this.video.loop=true;this.video.playsInline=true;this.video.preload='auto';
  this.video.setAttribute('muted','');this.video.setAttribute('playsinline','');
  this.video.src='ghost/sheet-loop.mp4';
  this.failed=false;this.video.addEventListener('error',()=>{this.failed=true});
 }
 play(){
  if(this.reduced||this.playing||this.failed)return;
  this.playing=true;
  this.video.play().catch(()=>{this.playing=false});
 }
 get status(){return this.opacity<.003?'hidden':this.reduced?'still · reduced motion':!this.video.paused&&this.video.readyState>=2?'video loop':'still fallback'}
 clear(){
  this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  this.opacity=0;this.target=null;this.lastAt=null;this.video.pause();this.playing=false;
 }
 draw(now,{visible=false,blackout=false,voice=0,opacity=.6,size=.95}={}){
  if(blackout){this.clear();return}
  const dt=this.lastAt===null?0:Math.min(100,Math.max(0,now-this.lastAt));this.lastAt=now;
  const desired=visible?opacity:0;
  this.opacity+=(desired-this.opacity)*(1-Math.exp(-dt/(visible?450:180)));
  if(this.opacity<.003&&!visible){if(this.playing||this.target)this.clear();return}
  if(visible)this.play();
  if(now-this.lastDraw<1000/30)return;this.lastDraw=now;
  const rect=this.canvas.getBoundingClientRect(),h=Math.min(960,Math.round(rect.height)),w=Math.round(h*rect.width/Math.max(1,rect.height));
  if(w<1||h<1)return;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  const ctx=this.ctx;ctx.clearRect(0,0,w,h);
  const layout=ghostLayout(w,h,size),pulse=this.reduced?0:Math.max(0,Math.min(1,voice));
  const playing=!this.reduced&&!this.failed&&this.video.readyState>=2&&!this.video.paused;
  const imageReady=this.image.complete&&this.image.naturalWidth>0;
  if(!playing&&!imageReady){this.target=null;return}
  // The MP4 is premultiplied onto black. A screen layer lets the mirror show
  // through its hem and eyeholes without depending on alpha-video support.
  ctx.save();ctx.globalAlpha=Math.min(1,this.opacity*(1+pulse*.12));ctx.globalCompositeOperation='screen';
  const dx=!playing&&!this.reduced?Math.sin(now/8000*Math.PI*2)*layout.width*.008:0;
  const dy=!playing&&!this.reduced?Math.sin(now/8000*Math.PI*2+.5)*layout.height*.008:0;
  const x=layout.x+dx,y=layout.y+dy;
  if(playing)ctx.drawImage(this.video,x,y,layout.width,layout.height);
  else ctx.drawImage(this.image,x,y+layout.height*.1,layout.width,layout.height*.8);
  ctx.restore();
  // Eye midpoint in the approved artwork, including the video matte margins.
  this.target=visible&&this.opacity>.03?{x:(x+layout.width*.49)/w,y:(y+layout.height*.317)/h}:null;
 }
}
