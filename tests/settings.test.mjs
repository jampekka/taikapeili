import assert from 'node:assert/strict';
import {loadSettings,saveSettings,EFFECT_CONTROLS} from '../assets/settings.js';
import {CAMERA_CONTROLS} from '../assets/camera-view.js';
import {GHOST_CONTROLS} from '../assets/ghost.js';
import {SCREAMS} from '../assets/screams.js';
let value;const storage={getItem(){return value},setItem(key,data){value=data}};
const defaults=loadSettings(storage);
assert.deepEqual(defaults,{cameraZoom:1,cameraPanX:0,cameraPanY:0,morph:1,morphSpeed:.9,rgbSplit:.77,sourcePunch:1.62,rippleStrength:1.78,rippleReach:2,sourceWander:1,lampBrightness:1,ghostRevision:3,ghostEnabled:true,ghostOpacity:.9,ghostSize:1.15,ghostStyle:'soft',volume:1,texts:false,boxes:true,encore:'original',scream:'sharp',closeWidth:.5,ending:'secret'});
for(const c of [...EFFECT_CONTROLS,...CAMERA_CONTROLS,...GHOST_CONTROLS]){saveSettings({...defaults,[c.key]:c.max},storage);assert.equal(loadSettings(storage)[c.key],c.max);saveSettings({...defaults,[c.key]:-99},storage);assert.equal(loadSettings(storage)[c.key],c.min)}
saveSettings({...defaults,ghostEnabled:false,ghostStyle:'classic'},storage);assert.equal(loadSettings(storage).ghostEnabled,false);assert.equal(loadSettings(storage).ghostStyle,'classic');
value=JSON.stringify({ghostEnabled:false,ghostOpacity:.1,ghostSize:.4,ghostStyle:'classic',volume:.4,closeWidth:.5});
assert.deepEqual(loadSettings(storage),{...defaults,ghostStyle:'classic',volume:.4},'Previously saved faint/disabled ghosts upgrade without changing the other settings');
value=JSON.stringify({ghostStyle:'invalid'});assert.equal(loadSettings(storage).ghostStyle,'soft');
assert.equal(saveSettings({...defaults,ending:'secret',encore:'original',scream:'sharpLong',volume:.4,morph:.3,texts:true,boxes:false,closeWidth:.6,provider:'server',model:'paid'},storage),true);
assert.deepEqual(loadSettings(storage),{...defaults,morph:.3,volume:.4,texts:true,boxes:false,closeWidth:.6,ending:'secret',encore:'original',scream:'sharpLong'});
assert.equal(JSON.parse(value).provider,undefined,'Paid provider selection must not be restored on a normal page load');
value=JSON.stringify({encore:true});assert.equal(loadSettings(storage).encore,'short','Existing enabled second scares migrate to the longer short option');
for(const encore of ['off','short','original']){saveSettings({...defaults,encore},storage);assert.equal(loadSettings(storage).encore,encore)}
value=JSON.stringify({encore:'invalid'});assert.equal(loadSettings(storage).encore,defaults.encore);
for(const scream of Object.keys(SCREAMS)){saveSettings({...defaults,scream},storage);assert.equal(loadSettings(storage).scream,scream)}
value=JSON.stringify({scream:'invalid'});assert.equal(loadSettings(storage).scream,defaults.scream);
value='{broken';assert.deepEqual(loadSettings(storage),defaults);
value=JSON.stringify({volume:4,morph:-1,closeWidth:.01,ending:'unknown',texts:'false'});assert.deepEqual(loadSettings(storage),{...defaults,volume:1,morph:0,closeWidth:.2});
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.deepEqual(loadSettings(blocked),defaults);assert.equal(saveSettings(defaults,blocked),false);
console.log('PASS: saved settings round trip, bounded values, malformed/blocked storage fallback, no paid-provider persistence');
