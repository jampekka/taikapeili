export const GHOST_CONTROLS=[
 {key:'ghostOpacity',label:'Ghost opacity',min:0,max:1,value:.9},
 {key:'ghostSize',label:'Ghost size',min:.4,max:1.3,value:1.15}
];
export const GHOST_STYLES={
 soft:{label:'5 · Soft gauze head',image:'head-soft.png',video:'head-soft-loop.mp4',eyeY:.425},
 classic:{label:'1 · Classic sheet head',image:'head-classic.png',video:'head-classic-loop.mp4',eyeY:.45}
};

// Keep the apparition out of detection/capture and out of both scare blackouts.
export function ghostVisible(state,hasCue,preview=false,speaking=false){
 if(state==='reveal')return false;
 // Actual playback also covers operator voice tests outside a sequence.
 if(speaking)return true;
 if(state==='after'||state==='error'||state==='finished')return false;
 return preview||state==='running'||state==='instruction'||state==='approach'&&hasCue;
}
export function ghostLayout(width,height,size=1.15){
 // The video frame has transparent margins around the actual head. Let those
 // margins extend outside the mirror so the head itself fills the centre.
 const h=Math.min(height*size,width*1.2/.8,height*1.3),w=h*.8;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}

export class GhostOverlay {
 constructor(canvas,{reduced=false}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reduced=reduced;
  this.opacity=0;this.lastAt=null;this.lastDraw=-Infinity;this.target=null;this.playing=false;
  this.image=new Image();
  this.layer=document.createElement('canvas');this.layer.width=512;this.layer.height=640;
  this.layerContext=this.layer.getContext('2d');
  this.video=document.createElement('video');this.video.muted=true;this.video.defaultMuted=true;
  this.video.loop=true;this.video.playsInline=true;this.video.preload='auto';
  this.video.setAttribute('muted','');this.video.setAttribute('playsinline','');
  this.video.addEventListener('error',()=>{this.failed=true});this.setStyle('soft');
 }
 setStyle(style){
  const selected=Object.hasOwn(GHOST_STYLES,style)?style:'soft';if(this.style===selected)return;
  this.video.pause();this.playing=false;this.failed=false;this.target=null;this.style=selected;
  this.image.src='ghost/'+GHOST_STYLES[selected].image;this.video.src='ghost/'+GHOST_STYLES[selected].video;
 }
 prepare(style){this.setStyle(style);return this.image.decode()}
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
 draw(now,{visible=false,blackout=false,voice=0,opacity=.9,size=1.15,style='soft'}={}){
  this.setStyle(style);
  if(blackout){this.clear();return}
  const dt=this.lastAt===null?33:Math.min(100,Math.max(0,now-this.lastAt));this.lastAt=now;
  const desired=visible?opacity:0;
  this.opacity+=(desired-this.opacity)*(1-Math.exp(-dt/(visible?90:180)));
  if(this.opacity<.003&&!visible){if(this.playing||this.target)this.clear();return}
  if(visible)this.play();
  if(now-this.lastDraw<1000/30)return;this.lastDraw=now;
  const rect=this.canvas.getBoundingClientRect(),h=Math.min(960,Math.round(rect.height)),w=Math.round(h*rect.width/Math.max(1,rect.height));
  if(w<1||h<1)return;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  const ctx=this.ctx;ctx.clearRect(0,0,w,h);
  const eyeY=.1+.8*GHOST_STYLES[this.style].eyeY;
  const layout=ghostLayout(w,h,size),pulse=this.reduced?0:Math.max(0,Math.min(1,voice));
  const playing=!this.reduced&&!this.failed&&this.video.readyState>=2&&!this.video.paused;
  const imageReady=this.image.complete&&this.image.naturalWidth>0;
  if(!imageReady){this.target=null;return}
  // Always paint the real alpha cutout. Detached video on iOS can report ready
  // before delivering frames; it must never make the apparition disappear.
  const layer=this.layerContext;layer.clearRect(0,0,512,640);
  layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
  layer.drawImage(this.image,0,64,512,512);
  if(playing){
   // Keep motion inside the cutout's alpha, with the still underneath. This
   // retains eye contrast and avoids screen blending against a bright camera.
   layer.globalCompositeOperation='source-atop';layer.globalAlpha=.35;
   layer.drawImage(this.video,0,0,512,640);
  }
  ctx.save();ctx.globalAlpha=Math.min(1,this.opacity*(1+pulse*.08));ctx.globalCompositeOperation='source-over';
  ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=layout.width*.035;
  const dx=!this.reduced?Math.sin(now/8000*Math.PI*2)*layout.width*.006:0;
  const dy=!this.reduced?Math.sin(now/8000*Math.PI*2+.5)*layout.height*.006:0;
  const x=layout.x+dx,y=layout.y+dy;
  ctx.drawImage(this.layer,x,y,layout.width,layout.height);
  ctx.restore();
  // Eye midpoint in the approved artwork, including the video matte margins.
  this.target=visible&&this.opacity>.03?{x:(x+layout.width*.5)/w,y:(y+layout.height*eyeY)/h}:null;
 }
}
