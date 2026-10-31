// Dummy-only hosting: no remote image providers or runtime credential access.
const responseJSON=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  // Temporary, authenticated build job for this one bundled voice line.
  if(url.pathname==='/api/operator/look-eyes-voice'){
   if(request.method!=='POST'||Date.now()>1793440017073)return new Response('Not found',{status:404});
   const bearer=request.headers.get('authorization')||'',token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
   if(token.length!==64)return new Response('Not found',{status:404});
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');
   if(digest!=='8fd515091d9f17e978d0503b29cdb7ae40c554dd9c616ea73d60a22730506da2')return new Response('Not found',{status:404});
   const response=await fetch('https://openrouter.ai/api/v1/audio/speech',{method:'POST',headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'elevenlabs/eleven-v4',voice:'sarah',input:'[whispering] Katso syvälle silmiin.',response_format:'mp3',provider:{options:{elevenlabs:{seed:17,language_code:'fi',voice_settings:{stability:.5,similarity_boost:.75}}}}})});
   if(!response.ok)return responseJSON({error:'Voice generation failed',status:response.status},502);
   const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const encoded=btoa(binary);
   const check=await fetch('https://openrouter.ai/api/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'elevenlabs/scribe-v2',input_audio:{data:encoded,format:'mp3'}})});
   const verification=check.ok?await check.json():{text:null};
   return responseJSON({audio:encoded,transcript:verification.text||null});
  }
  if(url.pathname==='/api/mirror/config'){
   if(request.method!=='GET')return responseJSON({error:'Method not allowed'},405);
   return responseJSON({configured:false,provider:'local'});
  }
  if(url.pathname==='/api/mirror/edit')return responseJSON({error:'Remote image generation is disabled'},410);
  if(url.pathname.startsWith('/api/'))return responseJSON({error:'Not found'},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname;
  const asset=BUNDLED_ASSETS[path];if(!asset)return new Response('Not found',{status:404});
  let bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
  if(path==='/index.html'&&url.searchParams.has('debug')){
   const html=new TextDecoder().decode(bytes).replace('href="manifest.webmanifest"','href="manifest-debug.webmanifest"').replace('name="apple-mobile-web-app-title" content="The Other Side"','name="apple-mobile-web-app-title" content="Mirror Debug"');
   bytes=new TextEncoder().encode(html);
  }
  const headers={'content-type':asset[0],'cache-control':path.startsWith('/models/')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff','content-length':String(bytes.length),'accept-ranges':'bytes'};
  // Safari requests byte ranges for inline video, including the initial probe.
  const range=request.headers.get('range');
  if(request.method==='GET'&&range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(match&&(match[1]||match[2])){
    const length=bytes.length,start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2])),end=match[1]?(match[2]?Math.min(length-1,Number(match[2])):length-1):length-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=length||start>end)return new Response(null,{status:416,headers:{...headers,'content-length':'0','content-range':`bytes */${length}`}});
    headers['content-range']=`bytes ${start}-${end}/${length}`;headers['content-length']=String(end-start+1);
    return new Response(bytes.slice(start,end+1),{status:206,headers});
   }
  }
  return new Response(request.method==='HEAD'?null:bytes,{headers});
 }
};
