import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..'),assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'};
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await collect(path);else{const bytes=await readFile(path);assets['/'+relative(resolve(root,'assets'),path).replaceAll('\\','/')]=[types[extname(path)]||'application/octet-stream',bytes.toString('base64')]}}}
await collect(resolve(root,'assets'));
const worker=await readFile(resolve(root,'worker/index.js'),'utf8');
await rm(resolve(root,'dist'),{recursive:true,force:true});await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),`const BUNDLED_ASSETS=${JSON.stringify(assets)};\n${worker}`);
await writeFile(resolve(root,'dist/.openai/hosting.json'),await readFile(resolve(root,'.openai/hosting.json')));
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets`);
