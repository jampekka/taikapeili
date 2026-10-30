export async function transformSnapshot({image,face,effect="zombie",intensity=.82}){
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');const W=c.width,H=c.height;
 const filters={zombie:`saturate(${.5-intensity*.35}) contrast(${1+intensity*.35}) brightness(${1-intensity*.12})`,aged:`saturate(${1-intensity*.65}) sepia(${intensity*.27}) contrast(${1+intensity*.18})`,ghost:`grayscale(1) contrast(${1+intensity*.3}) brightness(${1+intensity*.2})`};
 ctx.filter=filters[effect];ctx.drawImage(image,0,0);ctx.filter='none';
 const pixels=ctx.getImageData(0,0,W,H),p=pixels.data;
 let seed=12345;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 for(let k=0;k<p.length;k+=4){const n=(rand()-.5)*13*intensity;
  if(effect==='zombie'){p[k]=p[k]*(1-.14*intensity)+n;p[k+1]=p[k+1]*(1+.05*intensity)+n;p[k+2]=p[k+2]*(1-.05*intensity)+n}
  else if(effect==='ghost'){p[k]=p[k]*(1-.18*intensity)+n;p[k+1]=p[k+1]*(1-.04*intensity)+n;p[k+2]=Math.min(255,p[k+2]*(1+.12*intensity)+n)}
  else{p[k]+=n;p[k+1]+=n;p[k+2]+=n}
 }
 ctx.putImageData(pixels,0,0);
 const eyes=face.eyes.map(p=>({x:p.x*W,y:p.y*H})).sort((a,b)=>a.x-b.x);
 const mid={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2};
 const separation=Math.hypot(eyes[1].x-eyes[0].x,eyes[1].y-eyes[0].y);
 const overlayScale=separation/176.4;
 ctx.save();ctx.translate(mid.x,mid.y);ctx.rotate(Math.atan2(eyes[1].y-eyes[0].y,eyes[1].x-eyes[0].x));ctx.scale(overlayScale,overlayScale);ctx.translate(-450,-480);
 const x=450,y=480,s=1,faceW=900,faceH=1200;
 function ellipse(px,py,rx,ry,color){ctx.save();ctx.translate(px,py);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,.05,0,0,1);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore()}
 function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width*s;ctx.stroke()}
 ctx.globalAlpha=intensity;
 if(effect==='zombie'){
  [-1,1].forEach(side=>{
   ellipse(x+side*faceW*.098,y+faceH*.007,faceW*.086,faceH*.046,'rgba(25,18,30,.84)');
   ellipse(x+side*faceW*.14,y+faceH*.125,faceW*.08,faceH*.07,'rgba(32,43,24,.56)');
   // Branching veins follow the detected eye positions.
   for(let j=0;j<10;j++){const a=rand()*Math.PI*2,ex=x+side*faceW*.098+Math.cos(a)*faceW*.045,yy=y+Math.sin(a)*faceH*.02;let points=[[ex,yy]];let px=ex,py=yy;for(let n=0;n<4;n++){px+=Math.cos(a)*faceW*.011+(rand()-.5)*faceW*.02;py+=Math.sin(a)*faceH*.013+(rand()-.5)*faceH*.01;points.push([px,py])}line(points,'rgba(72,42,47,.5)',1.7);const b=points[2];line([b,[b[0]+side*14*s,b[1]+18*s]],'rgba(60,38,44,.35)',1)}
   ellipse(x+side*faceW*.098,y,faceW*.024,faceH*.012,'rgba(217,227,166,.65)');
  });ellipse(x,y+faceH*.17,faceW*.1,faceH*.023,'rgba(40,25,43,.4)');
  for(let j=0;j<24;j++)ellipse(x+(rand()-.5)*faceW*.33,y+rand()*faceH*.21,faceW*.008*(1+rand()),faceH*.007,'rgba(79,73,32,.28)');
 }else if(effect==='aged'){
  for(let j=0;j<5;j++){const yy=y-faceH*.055-j*faceH*.016;const pts=[];for(let i=0;i<=18;i++)pts.push([x-faceW*.115+i*faceW*.23/18,yy+Math.sin(i/18*Math.PI)*faceH*.005+(rand()-.5)*2*s]);line(pts,'rgba(54,39,24,.44)',1.7);line(pts.map(p=>[p[0],p[1]+2*s]),'rgba(241,216,176,.3)',1)}
  [-1,1].forEach(side=>{ellipse(x+side*faceW*.1,y+faceH*.025,faceW*.065,faceH*.022,'rgba(58,40,31,.3)');for(let j=0;j<5;j++){const px=x+side*faceW*.148,yy=y+(j-2)*faceH*.007;line([[px,yy],[px+side*faceW*.045,yy+(j-2)*faceH*.013]],'rgba(65,45,29,.53)',1.5)}for(let j=0;j<3;j++)line([[x+side*(faceW*.045+j*3*s),y+faceH*.065],[x+side*(faceW*.075+j*4*s),y+faceH*.105],[x+side*(faceW*.085+j*3*s),y+faceH*.15]],'rgba(61,40,28,.29)',1.6)});
  for(let j=0;j<100;j++)ellipse(x+(rand()-.5)*faceW*.34,y-faceH*.07+rand()*faceH*.29,faceW*.0015*(1+rand()),faceH*.0015,'rgba(87,54,22,.38)');
 }else{
  [-1,1].forEach(side=>{ellipse(x+side*faceW*.098,y,faceW*.052,faceH*.027,'rgba(147,213,226,.75)');ellipse(x+side*faceW*.098,y,faceW*.021,faceH*.01,'rgba(231,246,242,.9)')});
  ctx.globalCompositeOperation='screen';for(let j=0;j<9;j++){const xx=rand()*faceW;ellipse(xx,faceH*.75,faceW*.08,faceH*.7,'rgba(119,161,145,.07)')}ctx.globalCompositeOperation='source-over';
 }
 ctx.restore();ctx.globalAlpha=1;const vignette=ctx.createRadialGradient(W/2,H*.42,W*.17,W/2,H*.48,H*.67);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,`rgba(3,12,7,${.6*intensity})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);return c;
}
