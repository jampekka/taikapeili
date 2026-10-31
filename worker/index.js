// Dummy-only hosting: no remote image providers or runtime credential access.
const responseJSON=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
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
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset[0],'cache-control':path.startsWith('/models/')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff'}});
 }
};
