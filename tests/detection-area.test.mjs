import assert from 'node:assert/strict';
import {cameraCrop,detectionCrop} from '../assets/camera-view.js';
import {scanFaceToMirror,bothEyesVisible} from '../assets/tracker.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
for(const [width,height] of [[1280,960],[960,1280]])for(const ratio of [.75,1.5])for(const cameraZoom of [1,2,3])for(const cameraPanX of [-1,0,1]){
 const screen=cameraCrop(width,height,ratio,{cameraZoom,cameraPanX,cameraPanY:.3});
 assert.deepEqual(detectionCrop(width,height,screen,0),screen);
 assert.deepEqual(detectionCrop(width,height,screen,1),{x:0,y:0,width,height});
 for(const amount of [0,.3,.7,1]){
  const region=detectionCrop(width,height,screen,amount);
  assert.ok(region.x>=0&&region.y>=0&&region.x+region.width<=width+1e-8&&region.y+region.height<=height+1e-8);
  assert.ok(region.x<=screen.x&&region.y<=screen.y&&region.width>=screen.width&&region.height>=screen.height);
  const point=(x,y)=>({x:(screen.x+x*screen.width-region.x)/region.width,y:(screen.y+y*screen.height-region.y)/region.height});
  const face={center:point(.5,.5),width:screen.width*.4/region.width,height:screen.height*.5/region.height,eyes:[point(.35,.4),point(.65,.45)],nose:point(.5,.55)};
  const mapped=scanFaceToMirror(face,region,screen);
  assert.ok(Math.abs(mapped.center.x-.5)<1e-9&&Math.abs(mapped.width-.4)<1e-9);
  assert.ok(Math.abs(mapped.eyes[0].x-.35)<1e-9&&Math.abs(mapped.eyes[1].x-.65)<1e-9);
  assert.equal(bothEyesVisible(mapped),true,'Wider scan never changes displayed eye positions or closeness');
 }
}
const screen=cameraCrop(1280,960,.75,{cameraZoom:2}),region=detectionCrop(1280,960,screen,1);
const outside=scanFaceToMirror({center:{x:.1,y:.5},width:.2,height:.3,eyes:[{x:.05,y:.4},{x:.15,y:.4}]},region,screen);
assert.equal(bothEyesVisible(outside),false,'A detected off-screen face stays off-screen after mapping');

// An eye leaving the mirror during narration must return to approach rather
// than allow a broad-area detection to advance to the startle.
const app=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const routine=app.slice(app.indexOf('async function loadDetector('),app.indexOf('function updateCameraView('));
let callback,resets=0,starts=0;
const run={state:'running',reset(){resets++;this.state='idle'},observeFace(){}};
const source={width:1280,height:960};
const scope=vm.createContext({detector:null,epoch:7,source,glass:{getBoundingClientRect:()=>({width:768,height:1024})},config:{cameraZoom:2},cameraCrop,scanFaceToMirror,bothEyesVisible,run,performance:{now:()=>0},FaceTracker:class{ready=Promise.resolve();constructor(onResult){callback=onResult}},renderer:{projectPoint:p=>p},stats:{detections:0},mirror:{dataset:{}},log(){},updateLiveEyes(){},trackedFaces:[],lastFace:null,trigger(){if(run.state==='idle'){starts++;run.state='approach'}},drawTracking(){},updateDebug(){}});
await vm.runInContext(routine+';loadDetector()',scope);
callback({epoch:7,width:384,height:288,mapping:{region,sourceWidth:1280,sourceHeight:960},faces:[{center:{x:.1,y:.5},width:.2,height:.3,eyes:[{x:.05,y:.4},{x:.15,y:.4}]}]});
assert.equal(resets,1);assert.equal(starts,1);assert.equal(run.state,'approach');
run.state='instruction';callback({epoch:7,width:384,height:288,mapping:{region,sourceWidth:1280,sourceHeight:960},faces:[{center:{x:.1,y:.5},width:.2,height:.3,eyes:[{x:.05,y:.4},{x:.15,y:.4}]}]});
assert.equal(resets,1,'After-startle speech cannot restart the ghost sequence');
console.log('PASS: scan coverage endpoints, crop/pan mapping, stable apparent size and out-of-view approach restart');
