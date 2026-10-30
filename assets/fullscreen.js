// Invoke synchronously from a click handler, before awaiting audio or downloads.
export function enterFullscreen(doc=document){
 if(doc.fullscreenElement||doc.webkitFullscreenElement)return Promise.resolve(true);
 const root=doc.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
 if(!request)return Promise.resolve(false);
 try{return Promise.resolve(request.call(root)).then(()=>true,()=>false)}catch{return Promise.resolve(false)}
}
