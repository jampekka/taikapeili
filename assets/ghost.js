export const GHOST_CONTROLS=[
 {key:'ghostOpacity',label:'Ghost opacity',min:0,max:1,value:.9},
 {key:'ghostSize',label:'Ghost size',min:.4,max:1.3,value:1.15},
 {key:'ghostHover',label:'Ghost hovering',min:0,max:2,value:1},
 {key:'ghostEyeGlow',label:'Eye glow',min:0,max:2,value:1},
 {key:'ghostMinScale',label:'Minimum tracking size',min:.2,max:1.5,value:.65},
 {key:'ghostFollowSeconds',label:'Tracking smoothing',min:.05,max:3,value:.45}
];
export const GHOST_STYLES={
 soft:{label:'5 · Soft gauze head',image:'head-soft.png',video:'head-soft-loop.mp4',eyeY:.425,eyeX:[.38,.61],faceWidth:.568},
 classic:{label:'1 · Classic sheet head',image:'head-classic.png',video:'head-classic-loop.mp4',eyeY:.45,eyeX:[.39,.61],faceWidth:.632}
};

// Keep the apparition out of detection/capture and out of both scare blackouts.
export function ghostVisible(state,hasCue,preview=false,speaking=false){
 if(['reveal','after','instruction','error','finished'].includes(state))return false;
 // Actual playback also covers operator voice tests outside a sequence.
 if(speaking)return true;
 return preview||state==='running'||state==='approach'&&hasCue;
}
export function smoothGhostVoice(previous,level,dt){
 const sample=Math.max(0,Math.min(1,level||0)),windowMs=8000;
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
// Width of the actual cloth-covered face at eye height, excluding transparent
// video margins. Deliberately independent of viewer distance and head position.
export function ghostFaceWidth(width,height,size=1.15,style='soft'){
 const info=GHOST_STYLES[style]||GHOST_STYLES.soft;
 return ghostLayout(width,height,size).width*info.faceWidth/Math.max(1,width);
}
export function ghostEyePose(eyes,width,height,layout,info,gaze={x:0,y:0},{scaleToEyes=false,minScale=.65}={}){
 if(eyes?.length!==2||!eyes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const [a,b]=[...eyes].sort((a,b)=>a.x-b.x),dx=(b.x-a.x)*width,dy=(b.y-a.y)*height;
 if(Math.hypot(dx,dy)<1)return null;
 const rotation=Math.atan2(dy,dx),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
 const scale=scaleToEyes?Math.max(minScale,Math.hypot(dx,dy)/((info.eyeX[1]-info.eyeX[0])*layout.width)):1;
 const px=((info.eyeX[0]+info.eyeX[1])/2+gaze.x-.5)*layout.width*scale,py=(.1+.8*info.eyeY+gaze.y-.5)*layout.height*scale;
 return {cx:x*width-px*Math.cos(rotation)+py*Math.sin(rotation),cy:y*height-px*Math.sin(rotation)-py*Math.cos(rotation),rotation,scale};
}
export function followGhostPose(current,target,dt,seconds=.45){
 const alpha=1-Math.exp(-Math.max(0,dt)/(Math.max(.05,seconds)*1000));
 const angle=Math.atan2(Math.sin(target.rotation-current.rotation),Math.cos(target.rotation-current.rotation));
 return {x:current.x+(target.x-current.x)*alpha,y:current.y+(target.y-current.y)*alpha,rotation:current.rotation+angle*alpha,scale:current.scale+(target.scale-current.scale)*alpha};
}

export class GhostOverlay {
 constructor(canvas,{reduced=false}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reduced=reduced;
  this.opacity=0;this.voiceEnvelope=0;this.suppressed=false;this.lastAt=null;this.target=null;this.followEyes=null;this.followPose=null;this.lastEyesAt=-Infinity;
  this.image=new Image();
  this.layer=document.createElement('canvas');this.layer.width=512;this.layer.height=640;
  this.layerContext=this.layer.getContext('2d');
  this.setStyle('soft');
 }
 setStyle(style){
  const selected=Object.hasOwn(GHOST_STYLES,style)?style:'soft';if(this.style===selected)return;
  this.target=null;this.style=selected;
  this.image.src='ghost/'+GHOST_STYLES[selected].image;
 }
 prepare(style){this.setStyle(style);return this.image.decode()}
 setPhase(state){
  if(state==='reveal'){this.suppressed=true;this.clear()}
  else if(state==='approach'){const wasSuppressed=this.suppressed;this.suppressed=false;if(wasSuppressed)this.clear()}
 }
 get status(){return this.suppressed?'hidden after startle':this.opacity<.003?'hidden':this.reduced?'still · reduced motion':`hover · voice ${Math.round(this.voiceEnvelope*100)}%`}
 get trackingScale(){return this.followPose?.scale||1}
 clear(){
  this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  this.opacity=0;this.voiceEnvelope=0;this.target=null;this.followEyes=null;this.followPose=null;this.lastEyesAt=-Infinity;this.lastAt=null;
 }
 draw(now,{visible=false,blackout=false,voice=0,opacity=.9,size=1.15,hover=1,eyeGlow=1,style='soft',eyes=null,eyesAt=null,scaleToEyes=false,minScale=.65,followSeconds=.45}={}){
  this.setStyle(style);
  if(blackout||this.suppressed){this.clear();return}
  const dt=this.lastAt===null?33:Math.min(250,Math.max(0,now-this.lastAt));this.lastAt=now;
  this.voiceEnvelope=smoothGhostVoice(this.voiceEnvelope,visible?voice:0,dt);
  const voiceOpacity=1-Math.exp(-Math.max(0,this.voiceEnvelope-.002)*14);
  const desired=opacity*voiceOpacity;
  this.opacity+=(desired-this.opacity)*(1-Math.exp(-dt/(visible?90:180)));
  if(this.opacity<.003&&!visible){this.clear();return}
  const rect=this.canvas.getBoundingClientRect(),h=Math.min(960,Math.round(rect.height)),w=Math.round(h*rect.width/Math.max(1,rect.height));
  if(w<1||h<1)return;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  const ctx=this.ctx;ctx.clearRect(0,0,w,h);
  const eyeY=.1+.8*GHOST_STYLES[this.style].eyeY;
  const layout=ghostLayout(w,h,size),motion=ghostMotion(now,this.reduced?0:hover),gaze=this.reduced?{x:0,y:0}:ghostGaze(now);
  if(eyes?.length===2&&eyes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){
   const seen=Number.isFinite(eyesAt)?eyesAt:now;
   if(seen>=this.lastEyesAt){this.followEyes=[...eyes].sort((a,b)=>a.x-b.x).map(p=>({...p}));this.lastEyesAt=seen}
  }
  if(now-this.lastEyesAt>1500)this.followEyes=null;
  const imageReady=this.image.complete&&this.image.naturalWidth>0;
  if(!imageReady){this.target=null;return}
  // Paint only the real RGBA cutout. H.264 has an opaque black matte; keeping
  // animation in the native pose and shared warp preserves transparent margins.
  const layer=this.layerContext;layer.clearRect(0,0,512,640);
  layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
  layer.drawImage(this.image,0,64,512,512);
  const styleInfo=GHOST_STYLES[this.style];
  if(eyeGlow>0){
   // Paint the tiny points and their glow into the head at full alpha. The
   // completed apparition gets ONE opacity below, so eyes cannot fade ahead.
   layer.save();layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
   for(const eye of styleInfo.eyeX){
    const ex=(eye+gaze.x)*512,ey=(eyeY+gaze.y)*640,radius=512*.003;
    const haloRadius=512*.02*eyeGlow,halo=layer.createRadialGradient(ex,ey,0,ex,ey,haloRadius);
    halo.addColorStop(0,'rgba(225,250,255,.85)');halo.addColorStop(.2,'rgba(170,230,255,.5)');halo.addColorStop(1,'rgba(130,200,255,0)');
    layer.fillStyle=halo;layer.beginPath();layer.ellipse(ex,ey,haloRadius,haloRadius,0,0,Math.PI*2);layer.fill();
    layer.fillStyle='#fff';
    layer.beginPath();layer.ellipse(ex,ey,radius,radius,0,0,Math.PI*2);layer.fill();
   }
   layer.restore();
  }
  ctx.save();ctx.globalAlpha=this.opacity;ctx.globalCompositeOperation='source-over';
  const fallback={cx:layout.x+layout.width/2+motion.x*layout.width,cy:layout.y+layout.height/2+motion.y*layout.height,rotation:motion.rotation,scale:scaleToEyes?motion.scale:1};
  const desiredPose=ghostEyePose(this.followEyes,w,h,layout,styleInfo,gaze,{scaleToEyes,minScale})||fallback;
  const anchor=pose=>{const px=((styleInfo.eyeX[0]+styleInfo.eyeX[1])/2+gaze.x-.5)*layout.width*pose.scale,py=(eyeY+gaze.y-.5)*layout.height*pose.scale;return {x:(pose.cx+px*Math.cos(pose.rotation)-py*Math.sin(pose.rotation))/w,y:(pose.cy+px*Math.sin(pose.rotation)+py*Math.cos(pose.rotation))/h,rotation:pose.rotation,scale:pose.scale}};
  this.followPose=followGhostPose(this.followPose||anchor(fallback),anchor(desiredPose),dt,followSeconds);
  const {rotation,scale}=this.followPose,px=((styleInfo.eyeX[0]+styleInfo.eyeX[1])/2+gaze.x-.5)*layout.width*scale,py=(eyeY+gaze.y-.5)*layout.height*scale;
  const cx=this.followPose.x*w-px*Math.cos(rotation)+py*Math.sin(rotation),cy=this.followPose.y*h-px*Math.sin(rotation)-py*Math.cos(rotation);
  ctx.translate(cx,cy);ctx.rotate(rotation);ctx.scale(scale,scale);
  ctx.drawImage(this.layer,-layout.width/2,-layout.height/2,layout.width,layout.height);
  ctx.restore();
  // Align the scare to the actual moving eyes, including hover and gaze shift.
  this.target=visible&&this.opacity>.03?{x:this.followPose.x,y:this.followPose.y}:null;
 }
}
