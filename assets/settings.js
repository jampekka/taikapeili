import {SCREAMS} from './screams.js';
const KEY='halloween-mirror-settings-v1';
export const ENDINGS={
 invite:'Lähetä seuraava luokseni. Mutta jos spoilaat, kiroan sinut kahden asunnon loukkuun, puudutan sukupuolielimesi ja tilaan vanhemmillesi Elisa Viihteen.',
 secret:'Älä kerro minusta kenellekään. Jos kerrot, niin kiroan sinut kahden asunnon loukkuun, puudutan sukupuolielimesi ja tilaan vanhemmillesi Elisa Viihteen.'
};
export const EFFECT_CONTROLS=[
 {key:'morph',label:'Constant morph',min:0,max:1.5,value:.7},
 {key:'morphSpeed',label:'Morph speed',min:.2,max:2,value:1},
 {key:'rgbSplit',label:'RGB separation',min:0,max:2,value:1},
 {key:'sourcePunch',label:'Source punch',min:0,max:2,value:1},
 {key:'rippleStrength',label:'Travelling ripples',min:0,max:2,value:1},
 {key:'rippleReach',label:'Ripple reach',min:.4,max:2,value:1},
 {key:'sourceWander',label:'Source wandering',min:0,max:1,value:1},
 {key:'lampBrightness',label:'Lamp brightness',min:0,max:1,value:1}
];
const defaults={...Object.fromEntries(EFFECT_CONTROLS.map(c=>[c.key,c.value])),volume:.65,texts:false,boxes:true,encore:'off',scream:'scare',closeWidth:.45,ending:'invite'};
function clean(value){
 const saved=value&&typeof value==='object'?value:{},result={...defaults};
 for(const [key,min,max] of [...EFFECT_CONTROLS.map(c=>[c.key,c.min,c.max]),['volume',0,1],['closeWidth',.2,.9]])if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))result[key]=Math.max(min,Math.min(max,saved[key]));
 for(const key of ['texts','boxes'])if(typeof saved[key]==='boolean')result[key]=saved[key];
 if(['off','short','original'].includes(saved.encore))result.encore=saved.encore;
 else if(saved.encore===true)result.encore='short';
 if(Object.hasOwn(ENDINGS,saved.ending))result.ending=saved.ending;
 if(Object.hasOwn(SCREAMS,saved.scream))result.scream=saved.scream;
 return result;
}
export function loadSettings(storage){try{return clean(JSON.parse((storage||globalThis.localStorage).getItem(KEY)||'{}'))}catch{return {...defaults}}}
export function saveSettings(settings,storage){try{(storage||globalThis.localStorage).setItem(KEY,JSON.stringify(clean(settings)));return true}catch{return false}}
