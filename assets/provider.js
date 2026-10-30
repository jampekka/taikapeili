export const DEFAULT_MODEL='google/gemini-3.1-flash-lite-image';
export const API_URL='https://openrouter.ai/api/v1/images';
const edits={zombie:'Transform the main person into a terrifying photorealistic undead reflection: gray-green lifeless skin, deeply sunken dark eye sockets, eerie pale eyes, cracked skin and decayed horror-movie prosthetic makeup. The expression is sinister and startling. No graphic gore.',ghost:'Transform the main person into a terrifying photorealistic spectral apparition with corpse-pale skin, dark eye sockets and glowing cold white eyes. Eerie horror-movie makeup, sinister and startling. No graphic gore.',aged:'Transform the main person into an unsettling extremely old version of the same person: deeply wrinkled skin, sunken cheeks, thin gray hair and hollow haunted eyes. Photorealistic horror-movie prosthetics, startling. No graphic gore.'};
export function buildImageRequest({imageData,model=DEFAULT_MODEL,effect='zombie',ratio=1}){
 if(!/^data:image\/(jpeg|png|webp);base64,/.test(imageData))throw new Error('Invalid captured image');
 if(!model||model.length>200||/[\s]/.test(model))throw new Error('Invalid model ID');
 const body={model,prompt:`${edits[effect]||edits.zombie} Edit the supplied photograph. Preserve the person's recognizable identity, face position, head angle, pose, camera framing, clothing, other people and background exactly. Maintain the original composition and aspect ratio. Fill the image edge to edge. No text, logos, borders or mirror frame. Return the edited photograph.`,input_references:[{type:'image_url',image_url:{url:imageData}}]};
 if(model.startsWith('google/gemini-')){const ratios={'1:1':1,'3:4':.75,'4:3':4/3,'2:3':2/3,'3:2':1.5,'9:16':9/16,'16:9':16/9};body.aspect_ratio=Object.keys(ratios).sort((a,b)=>Math.abs(Math.log(ratios[a]/ratio))-Math.abs(Math.log(ratios[b]/ratio)))[0]}
 if(model.startsWith('google/gemini-3.1-'))body.resolution='1K';
 return body;
}
export function decodeImageResponse(payload){
 const item=payload.data?.[0];if(!item?.b64_json)throw new Error('The model returned no edited image');
 if(item.b64_json.length>40*1024*1024)throw new Error('The returned image is too large');
 const mime=item.media_type||'image/png';if(!/^image\/(png|jpeg|webp)$/.test(mime))throw new Error('Unsupported image format');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(item.b64_json))throw new Error('The returned image data is invalid');
 return {dataUrl:`data:${mime};base64,${item.b64_json}`,cost:Number.isFinite(payload.usage?.cost)?payload.usage.cost:null};
}
export function safeError(error,key=''){
 let s=String(error?.message||error||'Unknown error');if(key)s=s.split(key).join('[redacted]');return s.replace(/sk-or-[A-Za-z0-9_-]+/g,'[redacted]').replace(/data:image\/[^\s]+/g,'[image]').slice(0,280);
}
export async function requestImage({apiKey,imageData,model=DEFAULT_MODEL,effect,ratio,signal,fetchImpl=fetch}){
 if(!apiKey)throw new Error('No OpenRouter key configured');
 let response;
 try{response=await fetchImpl(API_URL,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(buildImageRequest({imageData,model,effect,ratio})),signal})}catch(error){if(error.name==='AbortError')throw error;throw new Error('OpenRouter could not be reached (network or CORS).')}
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(`OpenRouter ${response.status}: ${safeError(payload.error?.message||payload.message||'Request rejected',apiKey)}`);
 return decodeImageResponse(payload);
}

export async function requestServerImage({imageData,model,effect,ratio,signal,fetchImpl=fetch}){
 const response=await fetchImpl('/api/mirror/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageData,model,effect,ratio}),signal});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:`Mirror server ${response.status}: image edit failed`);
 if(typeof payload.dataUrl!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(payload.dataUrl))throw new Error('The server returned no edited image');
 return {dataUrl:payload.dataUrl,cost:Number.isFinite(payload.cost)?payload.cost:null};
}
