import assert from 'node:assert/strict';
import {loadSettings,saveSettings} from '../assets/settings.js';
let value;const storage={getItem(){return value},setItem(key,data){value=data}};
const defaults=loadSettings(storage);assert.equal(defaults.ending,'invite');assert.equal(defaults.closeWidth,.45);assert.equal(defaults.encore,'off');
assert.equal(saveSettings({...defaults,ending:'secret',encore:'original',volume:.4,morph:.3,texts:true,boxes:false,closeWidth:.6,provider:'server',model:'paid'},storage),true);
assert.deepEqual(loadSettings(storage),{morph:.3,volume:.4,texts:true,boxes:false,closeWidth:.6,ending:'secret',encore:'original'});
assert.equal(JSON.parse(value).provider,undefined,'Paid provider selection must not be restored on a normal page load');
value=JSON.stringify({encore:true});assert.equal(loadSettings(storage).encore,'short','Existing enabled second scares migrate to the longer short option');
for(const encore of ['off','short','original']){saveSettings({...defaults,encore},storage);assert.equal(loadSettings(storage).encore,encore)}
value=JSON.stringify({encore:'invalid'});assert.equal(loadSettings(storage).encore,'off');
value='{broken';assert.deepEqual(loadSettings(storage),defaults);
value=JSON.stringify({volume:4,morph:-1,closeWidth:.01,ending:'unknown',texts:'false'});assert.deepEqual(loadSettings(storage),{...defaults,volume:1,morph:0,closeWidth:.2});
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.deepEqual(loadSettings(blocked),defaults);assert.equal(saveSettings(defaults,blocked),false);
console.log('PASS: saved settings round trip, bounded values, malformed/blocked storage fallback, no paid-provider persistence');
