export const GHOST_CONTROLS=[
 {key:'ghostOpacity',label:'Ghost opacity',min:0,max:1,value:.9},
 {key:'ghostSize',label:'Ghost size',min:.4,max:1.3,value:1.15},
 {key:'ghostHover',label:'Ghost hovering',min:0,max:2,value:1},
 {key:'ghostEyeGlow',label:'Eye glow',min:0,max:2,value:1}
];
export const GHOST_STYLES={
 soft:{label:'5 · Soft gauze head',image:'head-soft.png',video:'head-soft-loop.mp4',eyeY:.425,eyeX:[.38,.61]},
 classic:{label:'1 · Classic sheet head',image:'head-classic.png',video:'head-classic-loop.mp4',eyeY:.45,eyeX:[.39,.61]}
};

// Keep the apparition out of detection/capture and out of both scare blackouts.
export function ghostVisible(state,hasCue,preview=false,speaking=false){
 if(['reveal','after','instruction','error','finished'].includes(state))return false;
 // Actual playback also covers operator voice tests outside a sequence.
 if(speaking)return true;
 return preview||state==='running'||state==='approach'&&hasCue;
}
export function smoothGhostVoice(previous,level,dt){
 const sample=Math.max(0,Math.min(1,level||0)),windowMs=sample>previous?700:1500;
 return previous+(sample-previous)*(1-Math.exp(-Math.max(0,dt)/windowMs));
}
export function ghostMotion(now,amount=1){
 const t=now/1000;
 return {x:amount*(.012*Math.sin(t*.73)+.004*Math.sin(t*.31+1)),y:amount*(.013*Math.sin(t*.59+.7)+.003*Math.sin(t*.9)),rotation:amount*.008*Math.sin(t*.39),scale:1+amount*.025*Math.sin(t*.57)};
}
export function ghostGaze(now){
 // Brief, shared saccades between several-second fixations; never a random walk.
 const t=now/3400,n=Math.floor(t),phase=Math.min(1,(t-n)*3400/140),ease=phase*phase*(3-2*phase);
 const point=i=>({x:Math.sin(i*2.17+.4)*.0035,y:Math.sin(i*3.71+1)*.002});
 const a=point(n-1),b=point(n);return {x:a.x+(b.x-a.x)*ease,y:a.y+(b.y-a.y)*ease};
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
  this.opacity=0;this.voiceEnvelope=0;this.suppressed=false;this.lastAt=null;this.target=null;this.playing=false;
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
 setPhase(state){
  if(state==='reveal'){this.suppressed=true;this.clear()}
  else if(state==='approach'){this.suppressed=false;this.clear()}
 }
 play(){
  if(this.reduced||this.playing||this.failed)return;
  this.playing=true;
  this.video.play().catch(()=>{this.playing=false});
 }
 get status(){return this.suppressed?'hidden after startle':this.opacity<.003?'hidden':this.reduced?'still · reduced motion':`hover · voice ${Math.round(this.voiceEnvelope*100)}%`}
 clear(){
  this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  this.opacity=0;this.voiceEnvelope=0;this.target=null;this.lastAt=null;this.video.pause();this.playing=false;
 }
 draw(now,{visible=false,blackout=false,voice=0,preview=false,opacity=.9,size=1.15,hover=1,eyeGlow=1,style='soft'}={}){
  this.setStyle(style);
  if(blackout||this.suppressed){this.clear();return}
  const dt=this.lastAt===null?33:Math.min(250,Math.max(0,now-this.lastAt));this.lastAt=now;
  this.voiceEnvelope=smoothGhostVoice(this.voiceEnvelope,visible?voice:0,dt);
  const voiceOpacity=preview&&visible?1:1-Math.exp(-Math.max(0,this.voiceEnvelope-.002)*14);
  const desired=opacity*voiceOpacity;
  this.opacity+=(desired-this.opacity)*(1-Math.exp(-dt/(visible?90:180)));
  if(this.opacity<.003&&!visible){if(this.playing||this.target)this.clear();return}
  if(visible)this.play();
  const rect=this.canvas.getBoundingClientRect(),h=Math.min(960,Math.round(rect.height)),w=Math.round(h*rect.width/Math.max(1,rect.height));
  if(w<1||h<1)return;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  const ctx=this.ctx;ctx.clearRect(0,0,w,h);
  const eyeY=.1+.8*GHOST_STYLES[this.style].eyeY;
  const layout=ghostLayout(w,h,size),motion=ghostMotion(now,this.reduced?0:hover),gaze=this.reduced?{x:0,y:0}:ghostGaze(now);
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
  ctx.save();ctx.globalAlpha=this.opacity;ctx.globalCompositeOperation='source-over';
  ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=layout.width*.035;
  const cx=layout.x+layout.width/2+motion.x*layout.width,cy=layout.y+layout.height/2+motion.y*layout.height;
  ctx.translate(cx,cy);ctx.rotate(motion.rotation);ctx.scale(motion.scale,motion.scale);
  ctx.drawImage(this.layer,-layout.width/2,-layout.height/2,layout.width,layout.height);
  const styleInfo=GHOST_STYLES[this.style];
  if(eyeGlow>0){
   ctx.shadowColor='#b5eaff';ctx.shadowBlur=layout.width*.025*eyeGlow;
   for(const eye of styleInfo.eyeX){
    const ex=(eye+gaze.x-.5)*layout.width,ey=(eyeY+gaze.y-.5)*layout.height;
    const rx=layout.width*.023,ry=rx*2;
    ctx.beginPath();ctx.moveTo(ex-rx,ey);ctx.quadraticCurveTo(ex,ey-ry,ex+rx,ey);ctx.quadraticCurveTo(ex,ey+ry,ex-rx,ey);ctx.closePath();
    ctx.fillStyle='#e0f7ff';ctx.fill();
    ctx.shadowBlur=layout.width*.008*eyeGlow;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.ellipse(ex,ey,rx*.45,rx*.45,0,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=layout.width*.025*eyeGlow;
   }
  }
  ctx.restore();
  // Align the scare to the actual moving eyes, including hover and gaze shift.
  const px=((styleInfo.eyeX[0]+styleInfo.eyeX[1])/2+gaze.x-.5)*layout.width*motion.scale,py=(eyeY+gaze.y-.5)*layout.height*motion.scale;
  this.target=visible&&this.opacity>.03?{x:(cx+px*Math.cos(motion.rotation)-py*Math.sin(motion.rotation))/w,y:(cy+px*Math.sin(motion.rotation)+py*Math.cos(motion.rotation))/h}:null;
 }
}
