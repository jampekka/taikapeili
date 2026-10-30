const $ = id => document.getElementById(id);
const video=$('video'), portrait=$('portrait'), mirror=$('mirror'), result=$('resultCanvas'), original=$('originalCanvas');
const names={zombie:'The Undead',aged:'Timeworn',ghost:'The Apparition'};
const state={phase:'idle',source:'demo',effect:'zombie',stream:null,facing:'user',auto:true,interval:10,hold:7,intensity:.7,guide:true,gentle:true,cx:.5,ey:.4,timer:null,token:0,original:null,uploadedURL:null};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function cancel(){clearInterval(state.timer);state.timer=null;state.token++;}
function setStatus(text){$('status').textContent=text;}
function updateUI(){
 const idle=state.phase==='idle',live=state.phase==='live',revealed=state.phase==='result',busy=['countdown','processing'].includes(state.phase);
 mirror.classList.toggle('idle',idle);mirror.classList.toggle('revealed',revealed);mirror.classList.remove('peeking');
 $('idleCopy').hidden=!idle;$('guide').hidden=!(live&&state.guide&&state.source!=='demo');
 $('liveControls').hidden=!(live||busy);$('resultControls').hidden=!revealed;$('resultTag').hidden=!revealed;
 $('revealButton').disabled=busy;$('startCamera').disabled=busy;$('demoButton').disabled=busy;
 $('switchCamera').hidden=state.source!=='camera'||busy;$('peekButton').setAttribute('aria-pressed','false');
 $('sourceLabel').textContent=idle?'THE LOOKING GLASS':state.source==='camera'?'LIVE CAMERA':state.source==='upload'?'YOUR PHOTOGRAPH':'DEMO PORTRAIT';
 $('liveIndicator').innerHTML='<i></i> '+(idle?'AWAITING YOU':revealed?'THE OTHER SIDE':busy?'LOOK CLOSER':state.source==='camera'?'LIVE':'READY');
 $('mirrorHint').textContent=revealed?'You were never alone.':busy?'Something is looking back.':idle?'A reflection with a secret.':'Hold still. Let the mirror find you.';
 $('startCamera').querySelector('span').textContent=state.stream?'Restart the camera':'Open the mirror';
 document.querySelector('.source-controls').classList.toggle('active',!idle);document.querySelector('.privacy').classList.toggle('active',!idle);
 document.querySelectorAll('.effect').forEach(b=>b.disabled=busy);
 $('autoLabel').textContent='';
}
function placeGuide(){const g=$('guide');g.style.left=`${(state.cx-.21)*100}%`;g.style.top=`${(state.ey-.176)*100}%`;}
function schedule(seconds,callback,label){
 clearInterval(state.timer);if(!state.auto)return;
 let remaining=seconds;const el=state.phase==='result'?$('status'):$('autoLabel');el.textContent=`${label} ${remaining}s`;
 state.timer=setInterval(()=>{if(document.hidden)return;remaining--;el.textContent=`${label} ${remaining}s`;if(remaining<=0){clearInterval(state.timer);callback()}},1000);
}
function enterLive(){cancel();state.phase='live';$('ritualOverlay').hidden=true;updateUI();setStatus(state.source==='camera'?'Your reflection, for now.':state.source==='demo'?'Demo portrait · no camera needed.':'Photo ready · tap between the eyes to align.');schedule(state.interval,reveal,'Next reveal in');}
function stopTracks(){if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=null;video.srcObject=null;}
function showImage(){video.style.display='none';portrait.style.display='block';}
async function startCamera(){
 cancel();const token=state.token;stopTracks();$('startCamera').disabled=true;setStatus('Opening the camera…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unavailable');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing},width:{ideal:1280},height:{ideal:960}},audio:false});
  if(token!==state.token){stream.getTracks().forEach(t=>t.stop());return}
  state.stream=stream;video.srcObject=stream;await video.play();
  if(!video.videoWidth)await new Promise(resolve=>video.addEventListener('loadeddata',resolve,{once:true}));
  state.source='camera';state.cx=.5;state.ey=.4;placeGuide();video.style.display='block';portrait.style.display='none';enterLive();
 }catch(error){
  if(token!==state.token)return;
  stopTracks();showImage();state.phase='idle';updateUI();
  const denied=error.name==='NotAllowedError';setStatus(denied?'Camera permission was declined. Try a demo or choose a photo.':'Camera unavailable here. Try a demo, or open this site in Safari.');
 }finally{$('startCamera').disabled=false}
}
async function demo(){cancel();stopTracks();if(state.uploadedURL){URL.revokeObjectURL(state.uploadedURL);state.uploadedURL=null}portrait.src='portrait.jpg';await portrait.decode();state.source='demo';portrait.alt='Sample portrait for the haunted mirror';state.cx=.5;state.ey=.4;placeGuide();showImage();enterLive();}
function capture(){
 const c=document.createElement('canvas');c.width=900;c.height=1200;const ctx=c.getContext('2d');
 const source=state.source==='camera'?video:portrait;const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;
 if(!sw||!sh)throw new Error('The image is not ready. Try again.');
 const scale=Math.max(c.width/sw,c.height/sh),w=sw*scale,h=sh*scale;
 if(state.source==='camera'&&state.facing==='user'){ctx.translate(c.width,0);ctx.scale(-1,1)}
 ctx.drawImage(source,(c.width-w)/2,(c.height-h)/2,w,h);return c;
}
// Adapter boundary: replace this async function with a server image-editing call.
// It accepts the captured portrait and returns a canvas/image; the reveal loop is independent.
async function generateMirrorSnapshot({image,effect,intensity,cx,ey,delay=true}){
 if(delay)await wait(1100);
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');const W=c.width,H=c.height;
 const filters={zombie:`saturate(${.5-intensity*.35}) contrast(${1+intensity*.35}) brightness(${1-intensity*.12})`,aged:`saturate(${1-intensity*.65}) sepia(${intensity*.27}) contrast(${1+intensity*.18})`,ghost:`grayscale(1) contrast(${1+intensity*.3}) brightness(${1+intensity*.2})`};
 ctx.filter=filters[effect];ctx.drawImage(image,0,0);ctx.filter='none';
 const pixels=ctx.getImageData(0,0,W,H),p=pixels.data;
 let seed=12345;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 for(let k=0;k<p.length;k+=4){const n=(rand()-.5)*13*intensity;
  if(effect==='zombie'){p[k]=p[k]*(1-.14*intensity)+n;p[k+1]=p[k+1]*(1+.05*intensity)+n;p[k+2]=p[k+2]*(1-.05*intensity)+n}
  else if(effect==='ghost'){p[k]=p[k]*(1-.18*intensity)+n;p[k+1]=p[k+1]*(1-.04*intensity)+n;p[k+2]=Math.min(255,p[k+2]*(1+.12*intensity)+n)}
  else{p[k]+=n;p[k+1]+=n;p[k+2]+=n}
 }
 ctx.putImageData(pixels,0,0);const x=cx*W,y=ey*H,s=W/900;
 function ellipse(px,py,rx,ry,color){ctx.save();ctx.translate(px,py);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,.05,0,0,1);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore()}
 function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width*s;ctx.stroke()}
 ctx.globalAlpha=intensity;
 if(effect==='zombie'){
  [-1,1].forEach(side=>{
   ellipse(x+side*W*.098,y+H*.007,W*.086,H*.046,'rgba(25,18,30,.84)');
   ellipse(x+side*W*.14,y+H*.125,W*.08,H*.07,'rgba(32,43,24,.56)');
   // Branching veins follow the eye sockets; placement can be adjusted on the mirror.
   for(let j=0;j<10;j++){const a=rand()*Math.PI*2,ex=x+side*W*.098+Math.cos(a)*W*.045,yy=y+Math.sin(a)*H*.02;let points=[[ex,yy]];let px=ex,py=yy;for(let n=0;n<4;n++){px+=Math.cos(a)*W*.011+(rand()-.5)*W*.02;py+=Math.sin(a)*H*.013+(rand()-.5)*H*.01;points.push([px,py])}line(points,'rgba(72,42,47,.5)',1.7);const b=points[2];line([b,[b[0]+side*14*s,b[1]+18*s]],'rgba(60,38,44,.35)',1)}
   ellipse(x+side*W*.098,y,W*.024,H*.012,'rgba(217,227,166,.65)');
  });ellipse(x,y+H*.17,W*.1,H*.023,'rgba(40,25,43,.4)');
  for(let j=0;j<24;j++)ellipse(x+(rand()-.5)*W*.33,y+rand()*H*.21,W*.008*(1+rand()),H*.007,'rgba(79,73,32,.28)');
 }else if(effect==='aged'){
  for(let j=0;j<5;j++){const yy=y-H*.055-j*H*.016;const pts=[];for(let i=0;i<=18;i++)pts.push([x-W*.115+i*W*.23/18,yy+Math.sin(i/18*Math.PI)*H*.005+(rand()-.5)*2*s]);line(pts,'rgba(54,39,24,.44)',1.7);line(pts.map(p=>[p[0],p[1]+2*s]),'rgba(241,216,176,.3)',1)}
  [-1,1].forEach(side=>{ellipse(x+side*W*.1,y+H*.025,W*.065,H*.022,'rgba(58,40,31,.3)');for(let j=0;j<5;j++){const px=x+side*W*.148,yy=y+(j-2)*H*.007;line([[px,yy],[px+side*W*.045,yy+(j-2)*H*.013]],'rgba(65,45,29,.53)',1.5)}for(let j=0;j<3;j++)line([[x+side*(W*.045+j*3*s),y+H*.065],[x+side*(W*.075+j*4*s),y+H*.105],[x+side*(W*.085+j*3*s),y+H*.15]],'rgba(61,40,28,.29)',1.6)});
  for(let j=0;j<100;j++)ellipse(x+(rand()-.5)*W*.34,y-H*.07+rand()*H*.29,W*.0015*(1+rand()),H*.0015,'rgba(87,54,22,.38)');
 }else{
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.13*intensity;ctx.drawImage(c,12*s,0);ctx.restore();ctx.globalAlpha=intensity;
  [-1,1].forEach(side=>{ellipse(x+side*W*.098,y,W*.052,H*.027,'rgba(147,213,226,.75)');ellipse(x+side*W*.098,y,W*.021,H*.01,'rgba(231,246,242,.9)')});
  ctx.globalCompositeOperation='screen';for(let j=0;j<9;j++){const xx=rand()*W;ellipse(xx,H*.75,W*.08,H*.7,'rgba(119,161,145,.07)')}ctx.globalCompositeOperation='source-over';
 }
 ctx.globalAlpha=1;const vignette=ctx.createRadialGradient(W/2,H*.42,W*.17,W/2,H*.48,H*.67);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,`rgba(3,12,7,${.6*intensity})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);return c;
}
function copyCanvas(source,target){target.width=source.width;target.height=source.height;target.getContext('2d').drawImage(source,0,0)}
async function renderResult(delay=true){const token=state.token;const c=await generateMirrorSnapshot({image:state.original,effect:state.effect,intensity:state.intensity,cx:state.cx,ey:state.ey,delay});if(token!==state.token)return false;copyCanvas(c,result);return true}
async function reveal(){
 if(state.phase!=='live')return;cancel();const token=state.token;state.phase='countdown';updateUI();$('ritualOverlay').hidden=false;$('ritualOverlay').classList.remove('processing');$('ritualText').textContent='Hold still. Look closer.';
 for(let n=3;n>0;n--){$('ritualNumber').textContent=n;setStatus(`Capturing in ${n}…`);await wait(1000);if(token!==state.token)return}
 try{
  state.original=capture();copyCanvas(state.original,original);state.phase='processing';$('ritualOverlay').classList.add('processing');$('ritualNumber').textContent='✧';$('ritualText').textContent='The glass remembers';setStatus('Your other self is taking shape…');
  if(!await renderResult())return;
  state.phase='result';$('ritualOverlay').hidden=true;$('resultName').textContent=names[state.effect];updateUI();
  if(!state.gentle){mirror.classList.add('shiver');setTimeout(()=>mirror.classList.remove('shiver'),600)}
  setStatus('A different you. Same looking glass.');schedule(state.hold,enterLive,'Back to the mirror in');
 }catch(error){enterLive();setStatus(error.message||'The reflection slipped away. Try again.')}
}
$('startCamera').addEventListener('click',startCamera);$('demoButton').addEventListener('click',()=>demo().catch(()=>setStatus('The demo could not load. Try a photo.')));$('revealButton').addEventListener('click',reveal);$('returnButton').addEventListener('click',enterLive);
$('photoInput').addEventListener('change',async event=>{const f=event.target.files[0];if(!f)return;if(!f.type.startsWith('image/')){toast('Please choose an image.');return}cancel();stopTracks();if(state.uploadedURL)URL.revokeObjectURL(state.uploadedURL);state.uploadedURL=URL.createObjectURL(f);portrait.src=state.uploadedURL;try{await portrait.decode();state.source='upload';portrait.alt='Your selected photograph';state.cx=.5;state.ey=.4;placeGuide();showImage();enterLive()}catch{setStatus('This image could not be opened. Try a JPEG or PNG.')}event.target.value=''});
$('switchCamera').addEventListener('click',()=>{state.facing=state.facing==='user'?'environment':'user';startCamera()});
video.addEventListener('loadedmetadata',()=>{video.style.transform=state.facing==='user'?'scaleX(-1)':'none'});
for(const button of document.querySelectorAll('.effect'))button.addEventListener('click',async()=>{state.effect=button.dataset.effect;document.querySelectorAll('.effect').forEach(b=>{const a=b===button;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a))});if(state.phase==='result'){await renderResult(false);$('resultName').textContent=names[state.effect]}});
mirror.addEventListener('click',e=>{if(!['live','result'].includes(state.phase))return;const r=mirror.getBoundingClientRect();state.cx=Math.max(.22,Math.min(.78,(e.clientX-r.left)/r.width));state.ey=Math.max(.15,Math.min(.7,(e.clientY-r.top)/r.height));placeGuide();if(state.phase==='result')renderResult(false);else toast('Eye position adjusted')});
$('peekButton').addEventListener('click',()=>{const peek=mirror.classList.toggle('peeking');$('peekButton').setAttribute('aria-pressed',String(peek));if(peek){clearInterval(state.timer);setStatus('Your original photograph. Tap Original again to return.')}else{setStatus('Your other self.');schedule(state.hold,enterLive,'Back to the mirror in')}});
$('saveButton').addEventListener('click',async()=>{clearInterval(state.timer);const exported=document.createElement('canvas');exported.width=result.width;exported.height=result.height;const ctx=exported.getContext('2d');ctx.drawImage(result,0,0);ctx.fillStyle='#0b130bc9';ctx.fillRect(0,exported.height-95,exported.width,95);ctx.fillStyle='#e0d7bd';ctx.font='24px Georgia';ctx.textAlign='center';ctx.fillText(`${names[state.effect]} · The Other Side`,exported.width/2,exported.height-39);exported.toBlob(async blob=>{if(!blob){toast('Could not save this reflection.');return}const file=new File([blob],`the-other-side-${state.effect}.png`,{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'My other self'})}else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Reflection saved')}}catch(error){if(error.name!=='AbortError')toast('Saving was unavailable. Try again.')}setStatus('Take your time. Return to the mirror when ready.')},'image/png')});
$('settingsButton').addEventListener('click',()=>{clearInterval(state.timer);$('settings').showModal()});$('settings').addEventListener('close',()=>{if(state.phase==='live')schedule(state.interval,reveal,'Next reveal in');if(state.phase==='result')schedule(state.hold,enterLive,'Back to the mirror in')});
$('autoMode').addEventListener('change',e=>{state.auto=e.target.checked;clearInterval(state.timer);$('autoLabel').textContent=state.auto?'':'Automatic reveals off';if(!state.auto&&state.phase==='result')setStatus('Your other self. Return to the mirror when ready.')});
for(const [id,key,output,suffix] of [['interval','interval','intervalValue','s'],['holdDuration','hold','holdValue','s'],['intensity','intensity','intensityValue','%']])$(id).addEventListener('input',e=>{const v=Number(e.target.value);state[key]=key==='intensity'?v/100:v;$(output).textContent=v+suffix;if(key==='intensity'&&state.phase==='result')renderResult(false)});
$('showGuide').addEventListener('change',e=>{state.guide=e.target.checked;updateUI()});$('gentle').addEventListener('change',e=>state.gentle=e.target.checked);
$('stopCamera').addEventListener('click',()=>{cancel();stopTracks();state.phase='idle';state.original=null;result.width=0;original.width=0;if(state.uploadedURL){URL.revokeObjectURL(state.uploadedURL);state.uploadedURL=null}portrait.src='portrait.jpg';state.source='demo';showImage();$('ritualOverlay').hidden=true;updateUI();setStatus('Allow the camera, or try the demo.');$('settings').close()});
$('fullscreenButton').addEventListener('click',async()=>{if(document.fullscreenElement){await document.exitFullscreen();return}const active=document.body.classList.toggle('kiosk');$('fullscreenButton').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');if(active){try{await document.documentElement.requestFullscreen?.()}catch{}toast('Mirror mode · tap the top-right corner to exit')}});
// An unobtrusive exit stays accessible in iPad browser fullscreen, where the API may not exist.
const exit=document.createElement('button');exit.className='icon-button kiosk-exit';exit.textContent='↙';exit.setAttribute('aria-label','Exit mirror mode');exit.style.cssText='position:fixed;right:16px;top:16px;z-index:20;display:none;background:#121511aa';document.body.append(exit);
const observer=new MutationObserver(()=>exit.style.display=document.body.classList.contains('kiosk')?'flex':'none');observer.observe(document.body,{attributes:true,attributeFilter:['class']});exit.onclick=()=>{document.body.classList.remove('kiosk');if(document.fullscreenElement)document.exitFullscreen()};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('kiosk')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('kiosk');if(e.code==='Space'&&e.target===document.body&&!$('settings').open){e.preventDefault();if(state.phase==='live')reveal();else if(state.phase==='result')enterLive()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(state.timer);if(['countdown','processing'].includes(state.phase))enterLive()}else if(!$('settings').open){if(state.phase==='live')schedule(state.interval,reveal,'Next reveal in');if(state.phase==='result')schedule(state.hold,enterLive,'Back to the mirror in')}});
window.addEventListener('pagehide',()=>{cancel();stopTracks()});updateUI();
