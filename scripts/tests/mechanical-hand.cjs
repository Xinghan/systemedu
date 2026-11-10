const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/mechanical-hand-20261110');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const ts=require('../../packages/student-web/node_modules/typescript'),dir=path.join(root,'packages/student-web/src/components/learning/mechanical-hand');
 const rig=JSON.parse(fs.readFileSync(path.join(dir,'rig.json')));
 const source=fs.readFileSync(path.join(dir,'kinematics.ts'),'utf8').replace('import rig from "./rig.json"','const rig = '+JSON.stringify(rig));
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const model=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const THREE=await import('../../packages/student-web/node_modules/three/build/three.module.js');
 const {GLTFLoader}=await import('../../packages/student-web/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const assetDir=path.join(root,'packages/student-web/public/mechanical-hand'),manifest=JSON.parse(fs.readFileSync(path.join(assetDir,'manifest.json')));
 for(const name of ['mechanical-hand.glb','mechanical-hand.blend','poster.png']){const bytes=fs.readFileSync(path.join(assetDir,name));assert.equal(bytes.length,manifest[name].bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest[name].sha256)}
 const bytes=fs.readFileSync(path.join(assetDir,'mechanical-hand.glb'));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=gltf.scene,rest=new Map();scene.traverse(o=>rest.set(o.name,o.quaternion.clone()));
 const get=n=>{const o=scene.getObjectByName(n);assert(o,n+' exists');return o};
 assert.equal(gltf.animations.length,1);assert.equal(gltf.animations[0].duration,4);
 let jointCount=0;scene.traverse(o=>{if(o.name.startsWith('Joint_'))jointCount++});assert.equal(jointCount,14);
 for(const f of rig.fingers){get('Finger_'+f.id);get('Drum_'+f.id)}
 // Known straight and right-angle chains, independent of authored rest mesh.
 const test={id:'index',base:[0,0,0],spread:0,lengths:[2,3],limits:[90,0],arms_mm:[4,3],radius:.5};
 assert.deepEqual(model.fingerPoints(test,0,0),[[0,0,0],[0,2,0],[0,5,0]]);
 const bent=model.fingerPoints(test,1,0);assert(Math.abs(bent[2][1])<1e-12);assert(Math.abs(bent[2][2]-5)<1e-12);
 assert(Math.abs(model.solveFinger(test,1,0,false).pull-2*Math.PI)<1e-10);
 let comparisons=0;
 for(const amount of [0,.2,.65,1,0])for(const opp of [0,.4,1]){
  for(const f of rig.fingers){
   const p=model.solveFinger(f,amount,opp,false),base=get('Finger_'+f.id);base.quaternion.copy(rest.get(base.name));
   if(f.id==='thumb')base.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,-1),opp*85*Math.PI/180));
   p.angles.forEach((angle,i)=>{const j=get(`Joint_${f.id}_${i}`);j.quaternion.copy(rest.get(j.name)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle*Math.PI/180))});
   scene.updateMatrixWorld(true);
   f.lengths.forEach((_,i)=>{const actual=get(`End_${f.id}_${i}`).getWorldPosition(new THREE.Vector3());assert(actual.distanceTo(new THREE.Vector3(...p.points[i+1]))<2e-5,'GLB joints agree with analytic forward kinematics');comparisons++});
  }
 }
 let contacts=0;
 let enclosedVertices=0;
 for(const f of rig.fingers)for(let i=0;i<f.lengths.length;i++){
  const joint=get(`Joint_${f.id}_${i}`),inverse=joint.matrixWorld.clone().invert();
  const visit=o=>{
   if(o!==joint&&o.name.startsWith('Joint_'))return;
   if(o.isMesh){const positions=o.geometry.attributes.position;for(let k=0;k<positions.count;k++){
    const p=new THREE.Vector3().fromBufferAttribute(positions,k).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
    assert(model.segmentDistance([0,0,0],[0,f.lengths[i],0],p.toArray())<=f.collision_radius+.005,`contact envelope encloses ${f.id} link ${i}: ${o.name}`);enclosedVertices++;
   }}
   o.children.forEach(visit);
  };visit(joint);
 }
 for(const f of rig.fingers)for(const opposition of [0,.2,.5,.7,1])for(const request of [0,.25,.5,.75,1]){
  const p=model.solveFinger(f,request,opposition,true);
  assert(p.amount<=request+1e-9);assert(p.amount>=0);assert(model.clearance(f,p.amount,opposition)>=-1e-5,`sphere clearance ${f.id}, opp=${opposition}, command=${request}`);
  if(p.contact){contacts++;assert(model.clearance(f,p.amount,opposition)<1e-3)}
 }
 assert(contacts>10,'sphere stops multiple finger trajectories');
 // Downloadable source animation must also keep each rope segment attached to its guides.
 scene.traverse(o=>o.quaternion.copy(rest.get(o.name)));
 const mixer=new THREE.AnimationMixer(scene),action=mixer.clipAction(gltf.animations[0]);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 let cableChecks=0;
 for(const time of [0,1,2,3,4,0]){
  action.paused=false;mixer.setTime(time);scene.updateMatrixWorld(true);
  scene.traverse(o=>{
   if(!o.userData.route_start_guide&&!o.userData.route_start_point)return;
   for(const [label,sign] of [['start',-1],['end',1]]){
    const guide=o.userData['route_'+label+'_guide'];
    const expected=guide?get(guide).getWorldPosition(new THREE.Vector3()):new THREE.Vector3(...o.userData['route_'+label+'_point']);
    const actual=new THREE.Vector3(0,sign*.5,0).applyMatrix4(o.matrixWorld);
    assert(actual.distanceTo(expected)<.005,`source tendon ${o.name} ${label} at ${time}s: ${actual.toArray()} vs ${expected.toArray()}`);cableChecks++;
   }
  });
 }
 assert(cableChecks>300);
 const report={passed:true,assetBytes:bytes.length,joints:jointCount,kinematicComparisons:comparisons,contactCases:contacts,enclosedVertices,animatedCableEndpoints:cableChecks,checks:['Original source, GLB and poster hashes','Four-second editable Blender animation with attached tendon endpoints','Five independently named fingers and drums, 14 flexion pivots','Analytic straight/right-angle cases and ideal tendon take-up','GLB joint endpoints agree with forward kinematics, including thumb opposition and reset','Contact capsules enclose rendered finger geometry','First-contact limits respect requested motion and capsule/sphere clearance']};
 fs.writeFileSync(path.join(out,'model-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
