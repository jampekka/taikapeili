import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const env={OPENROUTER_API_KEY:'sentinel-server-key',IMAGE_MODEL:'google/gemini-3.1-flash-lite-image'};
const origin='https://mirror.test';
const make=(path,options={})=>new Request(origin+path,options);
const config=await worker.fetch(make('/api/mirror/config'),env);const configText=await config.text();assert.equal(JSON.parse(configText).configured,true);assert.equal(configText.includes(env.OPENROUTER_API_KEY),false);
const script=await worker.fetch(make('/app.js'),env);assert.match(script.headers.get('content-type'),/javascript/);assert.equal((await script.text()).includes(env.OPENROUTER_API_KEY),false);
assert.equal((await worker.fetch(make('/'),env)).status,200);
const secretAudio=await worker.fetch(make('/audio/secret.mp3'),env);assert.equal(secretAudio.status,200);assert.match(secretAudio.headers.get('content-type'),/audio\/mpeg/);assert.ok((await secretAudio.arrayBuffer()).byteLength>1000,'The new whisper must be bundled, not just referenced');
assert.equal((await worker.fetch(make('/models/tiny_face_detector_model-shard1'),env)).status,200);
const body={imageData:'data:image/jpeg;base64,ZmFrZQ==',model:env.IMAGE_MODEL,effect:'zombie',ratio:.75};
const post=(overrides={})=>make('/api/mirror/edit',{method:'POST',headers:{'content-type':'application/json',origin,...overrides.headers},body:JSON.stringify({...body,...overrides.body})});
assert.equal((await worker.fetch(post(),{})).status,503);
assert.equal((await worker.fetch(post({headers:{origin:'https://unrelated.test'}}),env)).status,403);
assert.equal((await worker.fetch(post({body:{model:'unknown/model'}}),env)).status,400);
assert.equal((await worker.fetch(post({body:{imageData:'bad'}}),env)).status,400);
const originalFetch=globalThis.fetch;let upstream;
try{
 globalThis.fetch=async(url,options)=>{upstream={url,options};return new Response(JSON.stringify({data:[{b64_json:'aGVsbG8=',media_type:'image/png'}],usage:{cost:.01}}),{status:200})};
 const response=await worker.fetch(post(),env);assert.equal(response.status,200);const text=await response.text();assert.equal(text.includes(env.OPENROUTER_API_KEY),false);assert.equal(JSON.parse(text).cost,.01);assert.equal(upstream.options.headers.Authorization,'Bearer '+env.OPENROUTER_API_KEY);
 globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'Invalid '+env.OPENROUTER_API_KEY}}),{status:401});
 const failed=await worker.fetch(post(),env);assert.equal(failed.status,422);assert.equal((await failed.text()).includes(env.OPENROUTER_API_KEY),false);
}finally{globalThis.fetch=originalFetch}
console.log('PASS: embedded page/scripts/models, secret-free config, server authentication header, image edit, origin/format/model validation, redacted upstream errors');
