import assert from 'node:assert/strict';
import {buildOpenAIRequest,requestOpenAIImage,requestServerImage,safeError} from '../assets/provider.js';
import worker from '../dist/server/index.js';
const imageData='data:image/jpeg;base64,ZmFrZQ==';
const body=buildOpenAIRequest({imageData,ratio:.75});
assert.equal(body.model,'gpt-image-2.5-flare');assert.equal(body.quality,'low');assert.equal(body.output_format,'jpeg');assert.equal(body.size,'768x1024');assert.equal(body.images[0].image_url,imageData);
let sent;
const result=await requestOpenAIImage({apiKey:'sentinel-key',imageData,ratio:.75,fetchImpl:async(url,options)=>{sent={url,options};return new Response(JSON.stringify({data:[{b64_json:'aGVsbG8='}],usage:{output_tokens:100}}),{headers:{'x-request-id':'req-test'}})}});
assert.equal(sent.url,'https://api.openai.com/v1/images/edits');assert.equal(sent.options.headers.Authorization,'Bearer sentinel-key');assert.equal(sent.options.body.includes('sentinel-key'),false);assert.equal(result.dataUrl,'data:image/jpeg;base64,aGVsbG8=');assert.equal(result.requestId,'req-test');assert.equal(result.cost,null);
assert.equal(safeError('error sk-proj-abcdef12345'),'error [redacted]');
await assert.rejects(requestOpenAIImage({apiKey:'sentinel-key',imageData,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'bad sentinel-key'}}),{status:401})}),e=>/OpenAI 401/.test(e.message)&&!e.message.includes('sentinel-key'));
const env={OPENAI_API_KEY:'sentinel-key',IMAGE_MODEL:'gpt-image-2.5-flare'};
const post=signal=>new Request('https://mirror.test/api/mirror/edit',{method:'POST',headers:{origin:'https://mirror.test','content-type':'application/json'},body:JSON.stringify({imageData,ratio:.75}),signal});
const oldFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{sent={url,options};return new Response(JSON.stringify({data:[{b64_json:'aGVsbG8='}]}),{headers:{'x-request-id':'req-worker'}})};
 const config=await (await worker.fetch(new Request('https://mirror.test/api/mirror/config'),env)).json();assert.equal(config.configured,true);assert.equal(config.model,body.model);assert.equal(JSON.stringify(config).includes(env.OPENAI_API_KEY),false);
 const response=await worker.fetch(post(),env),payload=await response.json();assert.equal(response.status,200);assert.equal(payload.requestId,'req-worker');assert.equal(typeof payload.providerMs,'number');assert.equal(sent.url,'https://api.openai.com/v1/images/edits');
 // Cancel a held request and prove the server unlocks for the next request.
 let started;const ready=new Promise(resolve=>started=resolve);
 globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});started()});
 const cancel=new AbortController(),pending=worker.fetch(post(cancel.signal),env);await ready;
 assert.equal((await worker.fetch(post(),env)).status,409);cancel.abort();assert.equal((await pending).status,504);
 globalThis.fetch=async()=>new Response(JSON.stringify({data:[{b64_json:'aGVsbG8='}]}));assert.equal((await worker.fetch(post(),env)).status,200);
 const transport=await requestServerImage({imageData,fetchImpl:async()=>new Response(JSON.stringify(payload))});assert.equal(transport.providerMs,payload.providerMs);assert.equal(transport.requestId,'req-worker');
}finally{globalThis.fetch=oldFetch}
console.log('PASS: direct Flare edit, JPEG/quality/size, timing/request ID, no fabricated cost, key redaction, server configuration, cancellation releases busy lock');
