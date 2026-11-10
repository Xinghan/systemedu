const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
(async () => {
  const THREE = await import('../../packages/student-web/node_modules/three/build/three.module.js');
  const { GLTFLoader } = await import('../../packages/student-web/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const dir = path.join(root, 'packages/student-web/public/mars-landing');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  for (const name of ['mars-landing.glb','mars-landing.blend']) {
    const bytes=fs.readFileSync(path.join(dir,name));
    assert.equal(bytes.length,manifest[name].bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest[name].sha256);
  }
  const bytes = fs.readFileSync(path.join(dir,'mars-landing.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength),'');
  const scene=gltf.scene, mixer=new THREE.AnimationMixer(scene);
  const seek=t=>{for(const clip of gltf.animations){const a=mixer.clipAction(clip);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.paused=false;a.play()}mixer.setTime(t);scene.updateMatrixWorld(true)};
  assert.equal(gltf.animations.length,1);assert(Math.abs(gltf.animations[0].duration-42)<.01);
  const get=name=>{const o=scene.getObjectByName(name);assert(o,`${name} exists`);return o};
  for(const name of manifest.parts)get(name);
  const wheels=[];scene.traverse(o=>{if(o.name.startsWith('Wheel_')&&!o.isMesh)wheels.push(o)});assert.equal(wheels.length,6);
  const center=name=>get(name).getWorldPosition(new THREE.Vector3());
  seek(0);const initial=center('Rover').toArray();const heatInitial=center('HeatShield').y;
  const shellBounds=new THREE.Box3().setFromObject(get('Backshell')),heatBounds=new THREE.Box3().setFromObject(get('HeatShield'));
  assert(Math.abs(shellBounds.min.y-heatBounds.max.y)<.025,'heat shield meets backshell before separation');
  assert(shellBounds.clone().expandByScalar(.02).containsBox(new THREE.Box3().setFromObject(get('Rover'))),'stowed rover fits inside shell envelope');
  seek(6);assert(center('HeatShield').y<heatInitial-2);assert(center('Parachute').y>center('Backshell').y);
  seek(14);assert(Math.abs(center('Backshell').x-center('Rover').x)>3);assert(center('DescentStage').y>center('Rover').y);
  seek(25);
  for(let i=0;i<3;i++) {
    const cord=get('Bridle_'+i),box=new THREE.Box3().setFromObject(cord);
    assert(box.max.y>center('Rover').y+2);assert(box.max.y<center('DescentStage').y);assert(box.min.y>center('Rover').y+1.35);assert(box.min.y<center('Rover').y+1.5);
  }
  seek(32);const grounded=center('Rover').toArray();assert(Math.abs(grounded[1])<.001);
  for(const wheel of wheels){const box=new THREE.Box3().setFromObject(wheel);assert(box.min.y>=-.01&&box.min.y<.03,'all six wheels at surface')}
  seek(36);assert.deepEqual(center('Rover').toArray(),grounded);assert(Math.abs(center('DescentStage').x)>1);
  for(let i=0;i<3;i++){const box=new THREE.Box3().setFromObject(get('Bridle_'+i));assert(box.getSize(new THREE.Vector3()).length()<.01,'cables cut after touchdown')}
  seek(42);seek(0);assert.deepEqual(center('Rover').toArray(),initial,'seeking back from end restores start');
  const report={passed:true,assetBytes:bytes.length,animationClips:gltf.animations.length,duration:42,checks:['GLB and editable Blender source hashes match','Six wheels and five semantic assemblies','Closed shell envelope before heat shield separation','Heat shield before backshell separation','Cables connect descent stage and rover','Six wheels at surface before cable cut and flyaway','Rover stays on ground during flyaway','Seeking backward from final frame restores initial pose']};
  fs.writeFileSync(path.join(root,'artifacts/mars-landing-20261110/model-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
