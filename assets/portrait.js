export function revealZoom(elapsed,reduced=false){
 if(reduced)return 1.12;
 const t=Math.max(0,elapsed);
 if(t<50)return .02+1.78*(1-(1-t/50)**3);
 if(t<135)return 1.8-.3*(1-(1-(t-50)/85)**2);
 return 1.5+.15*Math.min(1,(t-135)/515);
}
export function revealImpact(elapsed,reduced=false){
 if(reduced)return {x:0,y:0,brightness:0};
 const t=Math.max(0,elapsed),fade=Math.max(0,1-t/650)**2,jolt=Math.floor(t/23);
 const pulse=(at,width)=>Math.exp(-(((t-at)/width)**2));
 return {x:.022*fade*Math.sin(jolt*2.4),y:.017*fade*Math.sin(jolt*4.1),brightness:.48*pulse(65,20)+.34*pulse(245,27)+.25*pulse(430,20)};
}
