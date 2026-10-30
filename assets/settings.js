const KEY='halloween-mirror-settings-v1';
export const ENDINGS={
 invite:'Lähetä seuraava luokseni. Mutta jos spoilaat, kiroan sinut kahden asunnon loukkuun, puudutan sukupuolielimesi ja tilaan vanhemmillesi Elisa Viihteen.',
 secret:'Älä kerro minusta kenellekään. Jos kerrot, niin kiroan sinut kahden asunnon loukkuun, puudutan sukupuolielimesi ja tilaan vanhemmillesi Elisa Viihteen.'
};
const defaults={morph:.7,volume:.65,texts:false,boxes:true,closeWidth:.45,ending:'invite'};
function clean(value){
 const saved=value&&typeof value==='object'?value:{},result={...defaults};
 for(const [key,min,max] of [['morph',0,1],['volume',0,1],['closeWidth',.2,.9]])if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))result[key]=Math.max(min,Math.min(max,saved[key]));
 for(const key of ['texts','boxes'])if(typeof saved[key]==='boolean')result[key]=saved[key];
 if(Object.hasOwn(ENDINGS,saved.ending))result.ending=saved.ending;
 return result;
}
export function loadSettings(storage){try{return clean(JSON.parse((storage||globalThis.localStorage).getItem(KEY)||'{}'))}catch{return {...defaults}}}
export function saveSettings(settings,storage){try{(storage||globalThis.localStorage).setItem(KEY,JSON.stringify(clean(settings)));return true}catch{return false}}
