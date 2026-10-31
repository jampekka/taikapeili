import {revealZoom,revealImpact} from './portrait.js';
import {projectLivePoint,sampleLivePoint,ripplePoint,lampSamplePoint} from './overlay.js';
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision mediump float;varying vec2 uv;uniform sampler2D image;uniform sampler2D lampImage;uniform float lampOpacity;uniform float time,zoom,power,mirror,scare;uniform vec2 cover;uniform float aspect;uniform vec4 ripples[8];uniform vec2 sources[12];uniform float speechPower;
vec2 ripplePoint(vec2 p){float shortSide=min(aspect,1.);float edgeDistance=min(min(p.x,1.-p.x)*aspect,min(p.y,1.-p.y))/shortSide;float fade=smoothstep(0.,.015,edgeDistance)*(1.-smoothstep(.17,.44,edgeDistance));float nearestEdge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));float sourceFade=smoothstep(0.,.015,p.x)*smoothstep(0.,.015,1.-p.x)*smoothstep(0.,.015,p.y)*smoothstep(0.,.015,1.-p.y)*(1.-smoothstep(.12,.36,nearestEdge));vec2 result=p;
if(speechPower>.00001){for(int i=0;i<12;i++){vec2 d=(p-sources[i])*vec2(aspect,1.);float radius=length(d);float amount=-speechPower*exp(-pow(radius/(aspect*.16),2.))*sourceFade;result+=d*amount/vec2(aspect,1.);}}
for(int i=0;i<8;i++){vec2 d=(p-ripples[i].zw)*vec2(aspect,1.);float radius=length(d);float age=ripples[i].x,amp=ripples[i].y;float front=radius-age*.48;float offset=amp*sin(front*39.269908)*exp(-front*front/.0288-radius/(shortSide*.25)-age*2.7);float t=clamp(radius/.06,0.,1.);float amount=offset*fade*t*t*(3.-2.*t);result+=d/max(radius,.0001)*amount/vec2(aspect,1.);}return result;}
vec2 warp(vec2 p,vec2 voiced,float channel){vec2 q=(p+(voiced-p)*(1.+channel*.45)-.5)/zoom+.5;q=(q-.5)*cover+.5;if(mirror>.5)q.x=1.-q.x;vec2 d=q-vec2(.5+.08*sin(time*.31),.48+.07*cos(time*.27));float radius=length(d);vec2 edge=2.*p-1.;float falloff=smoothstep(0.,.65,max(0.,(1.-edge.x*edge.x)*(1.-edge.y*edge.y)));float amount=power*falloff;q+=d*sin(radius*13.-time*1.9+channel*.8)*amount*.65;q.x+=sin(q.y*9.+time*.8+channel*.26)*amount*.45+sin(q.y*24.-time*1.3+channel)*amount*.12;q.y+=sin(q.x*11.-time*.6+channel*.33)*amount*.4;return q;}
vec4 sampleAt(vec2 p){if(scare>.5&&(p.x<0.||p.y<0.||p.x>1.||p.y>1.))return vec4(0.);return texture2D(image,clamp(p,vec2(0.),vec2(1.)));}
vec4 lampAt(vec2 q){vec2 screen=vec2(((1.-q.x)-.5)/cover.x+.5,(q.y-.5)/cover.y+.5);return texture2D(lampImage,clamp(screen,vec2(0.),vec2(1.)));}
void main(){vec2 voiced=ripplePoint(uv),rq=warp(uv,voiced,-1.),gq=warp(uv,voiced,0.),bq=warp(uv,voiced,1.);vec4 r=sampleAt(rq),g=sampleAt(gq),b=sampleAt(bq);vec3 rgb=vec3(r.r*r.a,g.g*g.a,b.b*b.a);
vec4 lr=lampAt(rq),lg=lampAt(gq),lb=lampAt(bq);vec3 alpha=lampOpacity*vec3(lr.a,lg.a,lb.a);rgb=rgb*(1.-alpha)+vec3(lr.r,lg.g,lb.b)*alpha;gl_FragColor=vec4(rgb,1.);}`;
// Equal physical perimeter spacing, with small fixed jitter and slow local wandering.
export const RIPPLE_SOURCE_COUNT=12;
export function rippleOrigin(index,time,aspect=1){
 const i=index%RIPPLE_SOURCE_COUNT,shortSide=Math.min(aspect,1),margin=.04*shortSide,width=aspect-2*margin,height=1-2*margin,perimeter=2*(width+height);
 let distance=(i+.5+.12*Math.sin(i*2.4))/RIPPLE_SOURCE_COUNT*perimeter,x,y;
 if(distance<width){x=margin+distance;y=margin}
 else if((distance-=width)<height){x=aspect-margin;y=margin+distance}
 else if((distance-=height)<width){x=aspect-margin-distance;y=1-margin}
 else{distance-=width;x=margin;y=1-margin-distance}
 const angle=time*(.11+i*.007)+i*2.4;
 return [(x+.025*shortSide*Math.cos(angle))/aspect,y+.025*shortSide*Math.sin(angle)];
}
export class MirrorRenderer {
 constructor(canvas,{onTick=()=>{},voiceLevel=()=>0,reduced=false,revealCanvas=null,lamps=null,lampOpacity=()=>1}={}){this.lamps=lamps;this.lampOpacity=lampOpacity;this.lampsReady=false;this.voiceLevel=voiceLevel;this.speechPulse=0;this.lastVoice=0;this.ripples=[];this.rippleIndex=0;this.lastRippleAt=-Infinity;this.speechAt=null;this.revealCanvas=revealCanvas;this.revealContext=revealCanvas?.getContext('2d',{alpha:false});if(revealCanvas)revealCanvas.hidden=true;this.canvas=canvas;this.onTick=onTick;this.reduced=reduced;this.source=null;this.scareImage=null;this.scareAt=-Infinity;this.until=0;this.lastDraw=0;this.strength=.7;
  try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false})}catch{}
  if(this.gl){try{this.initGL();this.backend='WebGL RGB warp'}catch{this.gl=null}}
  if(!this.gl){const replacement=document.createElement('canvas');replacement.id=canvas.id;replacement.className=canvas.className;canvas.replaceWith(replacement);this.canvas=replacement;this.ctx=replacement.getContext('2d',{alpha:false});this.scratch=document.createElement('canvas');this.sctx=this.scratch.getContext('2d',{willReadFrequently:true});this.backend='Canvas RGB warp'}
 }
 initGL(){const gl=this.gl;const compile=(kind,source)=>{const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return shader};const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');gl.useProgram(program);this.program=program;const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);this.uniforms={};for(const n of ['time','zoom','power','mirror','scare','cover','aspect','ripples[0]','sources[0]','speechPower','image','lampImage','lampOpacity'])this.uniforms[n]=gl.getUniformLocation(program,n);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(this.uniforms.image,0);gl.uniform1i(this.uniforms.lampImage,1);this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 this.lampTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.lampTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.activeTexture(gl.TEXTURE0);
 }
 start(source){this.source=source;if(this.running)return;this.running=true;this.tick(performance.now())}
 stop(){this.lampsReady=false;this.running=false;this.speechPulse=0;this.lastVoice=0;this.ripples=[];this.speechAt=null;cancelAnimationFrame(this.raf)}
 show(image,duration=650,focus={x:.5,y:.42},target={x:.5,y:.42}){this.scareImage=image;this.focus=focus;this.target=target;this.scareAt=performance.now();this.until=this.scareAt+duration;this.drawReveal(this.scareAt)}
 clearReveal(){this.until=0;this.scareImage=null;if(this.revealCanvas)this.revealCanvas.hidden=true}
 drawReveal(now){
  if(!this.revealCanvas||!this.scareImage)return;const c=this.revealCanvas,ctx=this.revealContext;c.hidden=false;const r=c.getBoundingClientRect();
  const h=Math.min(1200,Math.round(r.height)),w=Math.round(h*r.width/Math.max(1,r.height));if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  c.hidden=false;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const image=this.scareImage,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const elapsed=now-this.scareAt,impact=revealImpact(elapsed,this.reduced),scale=Math.max(w/iw,h/ih)*revealZoom(elapsed,this.reduced);
  ctx.translate(w*((this.target?.x??.5)+impact.x),h*((this.target?.y??.42)+impact.y));ctx.scale(scale,scale);ctx.translate(-this.focus.x*iw,-this.focus.y*ih);ctx.drawImage(image,0,0);
  if(impact.brightness>.01){ctx.globalCompositeOperation='screen';ctx.globalAlpha=impact.brightness;ctx.drawImage(image,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
 }
 tick(now){
  if(!this.running)return;
  // The live morph keeps its own clock and cadence, including behind the reveal.
  if(now-this.lastDraw>=(this.gl?32:80)){this.lastDraw=now;this.draw(now)}
  if(this.scareImage&&now<this.until)this.drawReveal(now);else if(this.scareImage)this.clearReveal();
  this.onTick(now);this.raf=requestAnimationFrame(t=>this.tick(t));
 }
 draw(now){const active=false;const image=this.source;if(!image)return;const iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;if(!iw||!ih)return;
  const rect=this.canvas.getBoundingClientRect(),ratio=rect.width/Math.max(1,rect.height);const h=Math.min(this.gl?1080:320,Math.round((this.gl?1280:320)/ratio)),w=Math.round(h*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  // Analyse the current speech window every draw. Direct source lenses follow it;
  // travelling rings are emitted by actual vocal rises, never a periodic timer.
  const voice=this.reduced?0:Math.max(0,Math.min(1,this.voiceLevel?.()||0));
  const dt=this.speechAt==null?33:Math.max(0,Math.min(100,now-this.speechAt));this.speechAt=now;
  const previous=this.speechPulse||0,rise=Math.max(0,voice-(this.lastVoice||0));this.lastVoice=voice;
  this.speechPulse=this.reduced?0:previous+(voice-previous)*(1-Math.exp(-dt/(voice>previous?12:65)));
  this.ripples=this.reduced?[]:(this.ripples||[]).filter(r=>now-r.at<1600);
  if(voice>.045&&this.strength>0&&(rise>.025||previous<.045)&&now-(this.lastRippleAt??-Infinity)>=65){
   const attack=Math.min(1,rise*3),amplitude=.12*this.strength*(voice*.35+attack*.65);
   // Strike opposing perimeter points, then scatter the next pair around the frame.
   const sourceIndex=this.rippleIndex||0;
   for(let i=0;i<2;i++){const origin=rippleOrigin(sourceIndex+i*RIPPLE_SOURCE_COUNT/2,now/1000,ratio);this.ripples.push({at:now,amplitude,origin})}
   this.rippleIndex=(sourceIndex+5)%RIPPLE_SOURCE_COUNT;
   this.ripples=this.ripples.slice(-8);this.lastRippleAt=now;
  }
  const ripples=this.ripples.map(r=>[(now-r.at)/1000,r.amplitude,r.origin[0],this.gl?1-r.origin[1]:r.origin[1]]);
  const sources=Array.from({length:RIPPLE_SOURCE_COUNT},(_,i)=>{const [x,y]=rippleOrigin(i,now/1000,ratio);return [x,this.gl?1-y:y]});
  const speechPower=this.reduced?0:.65*this.strength*this.speechPulse;
  const zoom=1,power=(this.reduced?.006:.025)*this.strength;
  const imageRatio=iw/ih,cover=imageRatio>ratio?[ratio/imageRatio,1]:[1,imageRatio/ratio];
  const lampOpacity=this.lamps?.lampRevision?Math.max(0,Math.min(1,this.lampOpacity?.()??1)):0;
  this.liveView={cover,power,time:now/1000,aspect:ratio,ripples,sources,speechPower,lampOpacity,flipY:!!this.gl};
  if(this.gl){const gl=this.gl;gl.viewport(0,0,w,h);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)}catch{return}for(const [n,v] of Object.entries({time:now/1000,zoom,power,mirror:active?0:1,scare:active?1:0}))gl.uniform1f(this.uniforms[n],v);gl.uniform2f(this.uniforms.cover,...cover);gl.uniform1f(this.uniforms.aspect,ratio);const packets=new Float32Array(32);ripples.forEach((r,i)=>packets.set(r,i*4));gl.uniform4fv(this.uniforms['ripples[0]'],packets);gl.uniform2fv(this.uniforms['sources[0]'],new Float32Array(sources.flat()));gl.uniform1f(this.uniforms.speechPower,speechPower);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.lampTexture);this.lampsReady=false;
   if(this.lamps?.lampRevision){try{if(this.lampUploadRevision!==this.lamps.lampRevision){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.lamps);this.lampUploadRevision=this.lamps.lampRevision}this.lampsReady=true}catch{}}
   gl.uniform1f(this.uniforms.lampOpacity,this.lampsReady?lampOpacity:0);gl.activeTexture(gl.TEXTURE0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
  else{this.drawCPU(image,w,h,this.liveView)}
 }
 projectPoint(point){return projectLivePoint(point,this.liveView)}
 lampPixels(width,height){
  if(!this.lamps?.lampRevision)return null;
  if(!this.lampScratch){this.lampScratch=document.createElement('canvas');this.lampContext=this.lampScratch.getContext('2d',{willReadFrequently:true})}
  if(this.lampPixelsRevision!==this.lamps.lampRevision||this.lampScratch.width!==width||this.lampScratch.height!==height){
   this.lampScratch.width=width;this.lampScratch.height=height;this.lampContext.drawImage(this.lamps,0,0,width,height);this.lampData=this.lampContext.getImageData(0,0,width,height).data;this.lampPixelsRevision=this.lamps.lampRevision;
  }
  return this.lampData;
 }
 drawCPU(image,w,h,view={}){
  const scale=Math.min(1,320/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));if(this.scratch.width!==sw||this.scratch.height!==sh){this.scratch.width=sw;this.scratch.height=sh}
  const ctx=this.sctx,iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;ctx.clearRect(0,0,sw,sh);ctx.drawImage(image,0,0,iw,ih,0,0,sw,sh);
  const input=ctx.getImageData(0,0,sw,sh),out=ctx.createImageData(sw,sh),src=input.data,dst=out.data,lamps=this.lampPixels?.(sw,sh),lampOpacity=view.lampOpacity??1;this.lampsReady=!!lamps;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const p={x:(x+.5)/sw,y:(y+.5)/sh},target=(y*sw+x)*4,voiced=ripplePoint(p,view);
   for(let c=0;c<3;c++){
    const q=sampleLivePoint(p,view,c-1,voiced),sx=Math.max(0,Math.min(sw-1,Math.floor(q.x*sw))),sy=Math.max(0,Math.min(sh-1,Math.floor(q.y*sh))),source=(sy*sw+sx)*4;
    let value=src[source+c]*src[source+3]/255;
    if(lamps&&lampOpacity>0){const point=lampSamplePoint(q,view),lx=Math.max(0,Math.min(sw-1,Math.floor(point.x*sw))),ly=Math.max(0,Math.min(sh-1,Math.floor(point.y*sh))),light=(ly*sw+lx)*4,alpha=lamps[light+3]/255*lampOpacity;value=value*(1-alpha)+lamps[light+c]*alpha}
    dst[target+c]=value;
   }dst[target+3]=255;
  }
  ctx.putImageData(out,0,0);this.ctx.drawImage(this.scratch,0,0,w,h);
 }
}
