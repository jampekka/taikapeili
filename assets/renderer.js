import {revealZoom,revealImpact} from './portrait.js';
import {projectLivePoint,centralScale} from './overlay.js';
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision mediump float;varying vec2 uv;uniform sampler2D image;uniform float bulge;uniform vec2 cover;
void main(){vec2 d=uv-.5;float edge=max(0.,(1.-4.*d.x*d.x)*(1.-4.*d.y*d.y));float scale=1.-bulge*exp(-12.5*dot(d,d))*edge;vec2 q=d*scale*cover+.5;q.x=1.-q.x;vec4 c=texture2D(image,clamp(q,vec2(0.),vec2(1.)));gl_FragColor=vec4(c.rgb*c.a,1.);}`;
export class MirrorRenderer {
 constructor(canvas,{onTick=()=>{},voiceLevel=()=>0,reduced=false,revealCanvas=null}={}){this.voiceLevel=voiceLevel;this.speechPulse=0;this.speechBody=0;this.speechBulge=0;this.revealCanvas=revealCanvas;this.revealContext=revealCanvas?.getContext('2d',{alpha:false});if(revealCanvas)revealCanvas.hidden=true;this.canvas=canvas;this.onTick=onTick;this.reduced=reduced;this.source=null;this.scareImage=null;this.scareAt=-Infinity;this.until=0;this.lastDraw=0;this.strength=.7;
  try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false})}catch{}
  if(this.gl){try{this.initGL();this.backend='WebGL central lens'}catch{this.gl=null}}
  if(!this.gl){const replacement=document.createElement('canvas');replacement.id=canvas.id;replacement.className=canvas.className;canvas.replaceWith(replacement);this.canvas=replacement;this.ctx=replacement.getContext('2d',{alpha:false});this.scratch=document.createElement('canvas');this.sctx=this.scratch.getContext('2d',{willReadFrequently:true});this.backend='Canvas central lens'}
 }
 initGL(){const gl=this.gl;const compile=(kind,source)=>{const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return shader};const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');gl.useProgram(program);this.program=program;const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);this.uniforms={};for(const n of ['bulge','cover'])this.uniforms[n]=gl.getUniformLocation(program,n);this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true)}
 start(source){this.source=source;if(this.running)return;this.running=true;this.tick(performance.now())}
 stop(){this.running=false;this.speechPulse=0;this.speechBody=0;this.speechBulge=0;cancelAnimationFrame(this.raf)}
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
 draw(now){
  const image=this.source;if(!image)return;const iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;if(!iw||!ih)return;
  const rect=this.canvas.getBoundingClientRect(),ratio=rect.width/Math.max(1,rect.height);const h=Math.min(this.gl?1080:320,Math.round((this.gl?1280:320)/ratio)),w=Math.round(h*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
  const voice=Math.max(0,Math.min(1,this.voiceLevel?.()||0));
  this.speechPulse=this.reduced?0:(this.speechPulse||0)+(voice-(this.speechPulse||0))*.35;
  this.speechBody=this.reduced?0:(this.speechBody||0)+(this.speechPulse-(this.speechBody||0))*.08;
  this.speechBulge=.24*this.strength*(this.speechPulse-this.speechBody);
  const bulge=(this.reduced?.006:.025*Math.sin(now*.0007))*this.strength+this.speechBulge;
  const imageRatio=iw/ih,cover=imageRatio>ratio?[ratio/imageRatio,1]:[1,imageRatio/ratio];
  this.liveView={cover,bulge,flipY:!!this.gl};
  if(this.gl){const gl=this.gl;gl.viewport(0,0,w,h);gl.useProgram(this.program);gl.bindTexture(gl.TEXTURE_2D,this.texture);try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)}catch{return}gl.uniform1f(this.uniforms.bulge,bulge);gl.uniform2f(this.uniforms.cover,...cover);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
  else this.drawCPU(image,w,h,cover,bulge);
 }
 projectPoint(point){return projectLivePoint(point,this.liveView)}
 drawCPU(image,w,h,cover,bulge=0){
  const scale=Math.min(1,320/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));if(this.scratch.width!==sw||this.scratch.height!==sh){this.scratch.width=sw;this.scratch.height=sh}
  const ctx=this.sctx,iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;ctx.clearRect(0,0,sw,sh);ctx.drawImage(image,0,0,iw,ih,0,0,sw,sh);
  const input=ctx.getImageData(0,0,sw,sh),out=ctx.createImageData(sw,sh),src=input.data,dst=out.data;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const u=(x+.5)/sw,v=(y+.5)/sh,lens=centralScale(u,v,bulge);
   const px=1-((u-.5)*lens*cover[0]+.5),py=(v-.5)*lens*cover[1]+.5;
   const sx=Math.max(0,Math.min(sw-1,Math.floor(px*sw))),sy=Math.max(0,Math.min(sh-1,Math.floor(py*sh))),source=(sy*sw+sx)*4,target=(y*sw+x)*4;
   for(let c=0;c<3;c++)dst[target+c]=src[source+c]*src[source+3]/255;dst[target+3]=255;
  }
  ctx.putImageData(out,0,0);this.ctx.drawImage(this.scratch,0,0,w,h);
 }
}
