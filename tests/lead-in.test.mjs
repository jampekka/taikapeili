import assert from 'node:assert/strict';
import {MirrorLeadIn} from '../assets/lead-in.js';
const lead=new MirrorLeadIn();lead.begin('visitor-a',1000,3000,4000);
assert.equal(lead.cue(1000),'come');assert.equal(lead.cue(3999),'come');assert.equal(lead.cue(4000),'look');assert.equal(lead.ready('visitor-a',7999),false);assert.equal(lead.ready('visitor-a',8000),true);assert.equal(lead.ready('visitor-b',9000),false);
lead.finish();assert.equal(lead.cue(9000),null);assert.equal(lead.ready('visitor-a',9000),true,'A paced cached reveal must not discard the later personalized result');
lead.cancel();assert.equal(lead.ready('visitor-a',9000),false,'Leaving cancels all pending narration/reveals');
lead.begin('visitor-c',10000,3000,4000);lead.extendSpeech('come',12000,2500);assert.equal(lead.comeUntil,15150);assert.equal(lead.readyAt,19150,'Late audio activation must not cut a whisper off');
console.log('PASS: Finnish cue order, minimum reveal gate, late speech, cached-then-personalized completion, cancellation');
