import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const port=Number(process.env.PORT)||4173;
createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,body:body.length?body:undefined});const response=await worker.fetch(request,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(error){res.writeHead(500);res.end('Preview error');console.error(error.message)}}).listen(port,'0.0.0.0',()=>console.log(`Mirror preview on ${port}`));
