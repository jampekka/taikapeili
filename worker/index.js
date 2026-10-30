// The build embeds BUNDLED_ASSETS and the shared provider functions in this module.
const responseJSON=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const MODEL_IDS=new Set(Object.keys(MODEL_PROFILES));
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/mirror/config'){
   if(request.method!=='GET')return responseJSON({error:'Method not allowed'},405);
   return responseJSON({configured:!!(env.OPENAI_API_KEY||env.OPENROUTER_API_KEY),model:env.IMAGE_MODEL||DEFAULT_MODEL,inputMaxEdge:512});
  }
  if(url.pathname==='/api/mirror/edit'){
   if(request.method!=='POST')return responseJSON({error:'Method not allowed'},405);
   // The owner-private Sites dispatch is the access boundary, including service access.
   // Reject cross-origin browser writes in addition to that platform authorization.
   const origin=request.headers.get('origin');if(origin&&!new Set([url.origin,'https://the-other-side-mirror.jampekka.chatgpt.site']).has(origin))return responseJSON({error:'Origin rejected'},403);

   if(!request.headers.get('content-type')?.startsWith('application/json'))return responseJSON({error:'JSON body required'},415);
   if(Number(request.headers.get('content-length'))>4000000)return responseJSON({error:'Image request too large'},413);

   let body;
   try{const raw=await request.text();if(raw.length>4000000)return responseJSON({error:'Image request too large'},413);body=JSON.parse(raw)}catch{return responseJSON({error:'Invalid JSON'},400)}
   const model=body.model||env.IMAGE_MODEL||DEFAULT_MODEL;
   if(!MODEL_IDS.has(model))return responseJSON({error:'Choose a supported image-editing model'},400);
   const openai=MODEL_PROFILES[model]?.provider==='openai',apiKey=openai?env.OPENAI_API_KEY:env.OPENROUTER_API_KEY;
   if(!apiKey)return responseJSON({error:'Selected image provider is not configured'},503);

   if(typeof body.imageData!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.imageData))return responseJSON({error:'Invalid captured image'},400);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),80000);
   const cancel=()=>controller.abort();request.signal.addEventListener('abort',cancel,{once:true});if(request.signal.aborted)cancel();
   try{
    const started=Date.now();
    const result=await (openai?requestOpenAIImage:requestImage)({apiKey,imageData:body.imageData,model,effect:['zombie','ghost','aged'].includes(body.effect)?body.effect:'zombie',ratio:Math.max(.25,Math.min(4,Number(body.ratio)||1)),resolution:['512','1K'].includes(body.resolution)?body.resolution:undefined,signal:controller.signal});
    return responseJSON({dataUrl:result.dataUrl,cost:result.cost,model,providerMs:Date.now()-started,requestId:result.requestId||null});
   }catch(error){const message=safeError(error,apiKey);const status=controller.signal.aborted?504:/(?:OpenRouter|OpenAI) (400|401|402|403|404|429):/.test(message)?422:502;return responseJSON({error:controller.signal.aborted?'Image provider timed out':message},status)}finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancel)}
  }
  if(url.pathname.startsWith('/api/'))return responseJSON({error:'Not found'},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname;
  const asset=BUNDLED_ASSETS[path];if(!asset)return new Response('Not found',{status:404});
  const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset[0],'cache-control':path.startsWith('/models/')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff'}});
 }
};
