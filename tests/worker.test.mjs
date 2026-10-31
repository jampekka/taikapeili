import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const env={OPENROUTER_API_KEY:'sentinel-server-key',OPENAI_API_KEY:'sentinel-openai-key'};
const origin='https://mirror.test';
const make=(path,options={})=>new Request(origin+path,options);
const config=await worker.fetch(make('/api/mirror/config'),env);const configText=await config.text();assert.equal(JSON.parse(configText).configured,false);assert.equal(configText.includes(env.OPENROUTER_API_KEY),false);
const script=await worker.fetch(make('/app.js'),env);assert.match(script.headers.get('content-type'),/javascript/);assert.equal((await script.text()).includes(env.OPENROUTER_API_KEY),false);
assert.equal((await worker.fetch(make('/'),env)).status,200);
const manifestResponse=await worker.fetch(make('/manifest.webmanifest'),env);assert.match(manifestResponse.headers.get('content-type'),/manifest\+json/);
const manifest=await manifestResponse.json();assert.equal(manifest.display,'fullscreen');assert.equal(manifest.start_url,'/');
for(const icon of [...manifest.icons,{src:'icon-180.png'}]){const response=await worker.fetch(make('/'+icon.src),env);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png')}

const warningAudio=await worker.fetch(make('/audio/warning.mp3'),env);assert.equal(warningAudio.status,200);assert.ok((await warningAudio.arrayBuffer()).byteLength>1000);
const privateAudio=await worker.fetch(make('/audio/warning-private.mp3'),env);assert.equal(privateAudio.status,200);assert.ok((await privateAudio.arrayBuffer()).byteLength>1000);
const secretAudio=await worker.fetch(make('/audio/secret.mp3'),env);assert.equal(secretAudio.status,200);assert.match(secretAudio.headers.get('content-type'),/audio\/mpeg/);assert.ok((await secretAudio.arrayBuffer()).byteLength>1000,'The new whisper must be bundled, not just referenced');
for(const name of ['opening.mp3','look-here.mp3','come-closer.mp3','scream-sharp.mp3','scream-shrill.mp3','scream-raw.mp3','scream-sharp-longer.mp3']){const response=await worker.fetch(make('/audio/'+name),env);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/audio\/mpeg/);assert.ok((await response.arrayBuffer()).byteLength>1000)}
assert.equal((await worker.fetch(make('/models/face_landmarker.task'),env)).status,200);
const wasm=await worker.fetch(make('/vendor/mediapipe/wasm/vision_wasm_internal.wasm'),env);assert.equal(wasm.headers.get('content-type'),'application/wasm');assert.deepEqual([...new Uint8Array(await wasm.arrayBuffer()).slice(0,4)],[0,97,115,109]);
assert.equal((await worker.fetch(make('/face-worker.js'),env)).status,200);
const originalFetch=globalThis.fetch;let requests=0;
try{
 globalThis.fetch=async()=>{requests++;throw new Error('Disabled endpoint must never contact a provider')};
 const forbiddenEnv=new Proxy(env,{get(){throw new Error('Disabled endpoint must never read runtime credentials')}});
 for(const runtime of [{},env,forbiddenEnv]){
  const configResponse=await worker.fetch(make('/api/mirror/config'),runtime);assert.deepEqual(await configResponse.json(),{configured:false,provider:'local'});
  for(const method of ['GET','POST','PUT','DELETE']){
   const response=await worker.fetch(make('/api/mirror/edit',{method,headers:{'content-type':'application/json',origin},...(method==='POST'?{body:JSON.stringify({imageData:'data:image/jpeg;base64,ZmFrZQ==',model:'gpt-image-2.5-flare'})}:{})}),runtime);
   assert.equal(response.status,410);assert.match((await response.json()).error,/disabled/);
  }
 }
 assert.equal(requests,0);
}finally{globalThis.fetch=originalFetch}
console.log('PASS: bundled page/audio/models; image endpoint always disabled, no credential reads and no upstream requests');
