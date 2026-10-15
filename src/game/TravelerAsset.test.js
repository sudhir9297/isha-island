import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Box3, Vector3, Texture, Group, Raycaster } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { placeCarriedBag, setCarryingArms, updateTravelerGrip } from './LuggageCarry.js';
import { blinkAmount, reliefBlink, updateTravelerFace } from './TravelerFace.js';
import { createTravelerMotion } from './TravelerMotion.js';
import { createTravelerAsset } from './TravelerAsset.js';
import { travelerLegPose, travelerUpperPose, WALK_HIP_HEIGHT } from './TravelerGait.js';

const bytes = readFileSync(new URL('../../public/models/sankaran-pillai.glb', import.meta.url));
// Node has no browser image decoder; skeletal checks use placeholder textures.
// Embedded image payloads are verified separately below.
const loader = new GLTFLoader();
loader.register(() => ({ name: 'NodeTexturePlaceholder', loadTexture: () => Promise.resolve(new Texture()) }));
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

function update(asset) {
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
}

test('exported character has normalized skin weights and independent instance bones', () => {
  const a = createTravelerAsset(gltf.scene), b = createTravelerAsset(gltf.scene);
  let meshes = 0;
  a.scene.traverse(object => {
    if (!object.isSkinnedMesh) return;
    meshes++;
    assert.equal(object.skeleton.bones.length, 25);
    const weights = object.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      assert.ok(Math.abs(sum - 1) < 1e-5, `unweighted vertex ${i} in ${object.name}`);
    }
  });
  assert.ok(meshes > 0);
  a.arms[0].rotation.x = .7;
  assert.ok(Math.abs(b.arms[0].rotation.x) < 1e-8);
  update(b);
  const size = new Box3().setFromObject(b.scene, true).getSize(new Vector3());
  assert.ok(size.y > 2.2 && size.y < 2.3);
  assert.ok(size.x < 1.2);
});

test('seated clip bends the legs and all garment material primitives together', () => {
  const asset = createTravelerAsset(gltf.scene);
  const mixer = new AnimationMixer(asset.scene);
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Seated')).play();
  mixer.update(.4);
  update(asset);
  assert.ok(Math.abs(asset.legs[0].rotation.x - 1.45) < 1e-5);
  assert.ok(Math.abs(asset.body.position.y + .36) < 1e-5);
  let clothParts = 0;
  asset.cloth.traverse(object => {
    if (!object.isMesh) return;
    clothParts++;
    assert.equal(object.morphTargetInfluences[0], 1);
  });
  assert.equal(clothParts, 1);
  mixer.stopAllAction();
});

test('game gait moves skinned bare feet without moving the other instance', () => {
  const asset = createTravelerAsset(gltf.scene);
  asset.legs[0].position.y = WALK_HIP_HEIGHT;
  const standing = travelerLegPose(0, 0);
  asset.legs[0].rotation.x = standing.hip;
  asset.knees[0].rotation.x = standing.knee;
  asset.ankles[0].rotation.x = standing.ankle;
  update(asset);
  const before = asset.ankles[0].getWorldPosition(new Vector3());
  const pose = travelerLegPose(Math.PI * 1.5, 1);
  asset.legs[0].rotation.x = pose.hip;
  asset.knees[0].rotation.x = pose.knee;
  asset.ankles[0].rotation.x = pose.ankle;
  update(asset);
  const after = asset.ankles[0].getWorldPosition(new Vector3());
  assert.ok(after.y > before.y + .07, 'swing foot should clear the ground');
  const vertex = new Vector3();
  asset.scene.traverse(object => {
    if (!object.isSkinnedMesh) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i += 17) {
      object.getVertexPosition(i, vertex);
      assert.ok(vertex.toArray().every(Number.isFinite));
      assert.ok(vertex.length() < 4, 'skin deformation must remain near the character');
    }
  });
});

test('portable GLB includes usable idle, walking, seated and pointing clips', () => {
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), ['Idle', 'Jump', 'JumpRun', 'Point', 'Relief', 'Run', 'Seated', 'Walk']);
  for (const clip of gltf.animations) {
    assert.ok(clip.duration >= .6);
    assert.ok(clip.tracks.length > 20);
  }
  const asset = createTravelerAsset(gltf.scene), mixer = new AnimationMixer(asset.scene);
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Point')).play();
  mixer.update(.5);
  assert.ok(asset.arms[0].rotation.z < -2.0);
  mixer.stopAllAction();
});

test('exported walk matches the game skeleton and alternates the cloth at each step', () => {
  const asset = createTravelerAsset(gltf.scene), mixer = new AnimationMixer(asset.scene);
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Walk')).play();
  for (const time of [0, .25, .5, .75]) {
    mixer.setTime(time);
    const phase = time * Math.PI * 2;
    const leg = travelerLegPose(phase, 1), upper = travelerUpperPose(phase, 1);
    assert.ok(Math.abs(asset.legs[0].rotation.x - leg.hip) < 1e-5);
    assert.ok(Math.abs(asset.knees[0].rotation.x - leg.knee) < 1e-5);
    assert.ok(Math.abs(asset.arms[0].rotation.x - upper.arm) < 1e-5);
    assert.ok(Math.abs(asset.legs[0].position.y - WALK_HIP_HEIGHT) < 1e-5);
    assert.ok(Math.abs(asset.cloth.morphTargetInfluences[1] - (.5 + .5*Math.cos(phase))) < 1e-5);
    assert.ok(Math.abs(asset.cloth.morphTargetInfluences[2] - (.5 - .5*Math.cos(phase))) < 1e-5);
  }
  mixer.stopAllAction();
});

test('Meshy textures are embedded in the portable model', () => {
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(json.images.length >= 3);
  for (const image of json.images) {
    assert.equal(image.uri, undefined);
    assert.ok(json.bufferViews[image.bufferView].byteLength > 1000);
  }
});


test('carry handles stay at the hands throughout walking and turning', () => {
  const asset = createTravelerAsset(gltf.scene);
  const world = new Group(), bagParent = new Group();
  world.add(asset.scene, bagParent);
  bagParent.position.set(2, .4, -3);
  bagParent.rotation.y = -.4;
  const bags = [new Group(), new Group()];
  bagParent.add(...bags);
  const mixer = new AnimationMixer(asset.scene);
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Walk')).play();
  for (const heading of [0, .8, Math.PI, -1.7]) {
    asset.scene.position.set(-3, .2, 4);
    asset.scene.rotation.y = heading;
    for (let frame = 0; frame < 24; frame++) {
      mixer.setTime(frame / 24);
      setCarryingArms(asset.arms);
      world.updateMatrixWorld(true);
      for (const [side, bag] of bags.entries()) {
        placeCarriedBag(bag, side === 0 ? 0 : 2, asset.body, asset.hands, asset.scene);
        const grip = bag.localToWorld(new Vector3(0, side === 0 ? .39 : .28, 0));
        const palm = asset.hands[side].localToWorld(new Vector3(side === 0 ? -.005 : .005, .005, -.02));
        assert.ok(grip.distanceTo(palm) < 1e-6, 'handle drifted from palm');
        const local = asset.scene.worldToLocal(bag.getWorldPosition(new Vector3()));
        assert.ok(Math.abs(local.x) > .60, 'bag must clear the sides of the dhoti');
        assert.ok(local.y > .34, 'bag must remain above the ground');
      }
    }
  }
});


test('carrying curls only the hands and releases back to the relaxed shape', () => {
  const asset = createTravelerAsset(gltf.scene);
  assert.ok(asset.grip.length > 0, 'export must include CarryGrip');
  let totalMoved = 0;
  for (const { mesh, index } of asset.grip) {
    assert.equal(mesh.morphTargetInfluences[index], 0);
    const positions = mesh.geometry.attributes.position;
    const deltas = mesh.geometry.morphAttributes.position[index];
    let moved = 0;
    for (let i = 0; i < positions.count; i++) {
      const displacement = new Vector3().fromBufferAttribute(deltas, i);
      if (displacement.length() < 1e-6) continue;
      moved++;
      assert.ok(Math.abs(positions.getX(i)) > .43, 'grip must not deform torso');
      assert.ok(displacement.length() < .15, 'grip deformation must remain local');
    }
    totalMoved += moved;
  }
  assert.ok(totalMoved > 100);
  updateTravelerGrip(asset.grip, true, 1);
  for (const { mesh, index } of asset.grip) assert.ok(mesh.morphTargetInfluences[index] > .99);
  updateTravelerGrip(asset.grip, false, 1);
  for (const { mesh, index } of asset.grip) assert.ok(mesh.morphTargetInfluences[index] < .001);
});


test('both oval eyes blink together and remain attached to the animated head', () => {
  const asset = createTravelerAsset(gltf.scene);
  assert.equal(asset.eyes.length, 2);
  assert.equal(blinkAmount(1), 0);
  assert.ok(blinkAmount(3.885) > .999);
  assert.equal(blinkAmount(4.1), 0);
  updateTravelerFace(asset.eyes, 3.885);
  for (const { mesh, index } of asset.eyes) {
    assert.ok(mesh.morphTargetInfluences[index] > .999);
    let parent = mesh.parent;
    while (parent && parent.name !== 'head') parent = parent.parent;
    assert.ok(parent, 'eye must follow the head bone');
  }
  updateTravelerFace(asset.eyes, 4.1);
  for (const { mesh, index } of asset.eyes) assert.equal(mesh.morphTargetInfluences[index], 0);
});


test('Run loops cleanly and Jump lifts both feet then recovers', () => {
  const asset = createTravelerAsset(gltf.scene), mixer = new AnimationMixer(asset.scene);
  const run = gltf.animations.find(clip => clip.name === 'Run');
  for (const track of run.tracks) {
    const width = track.getValueSize();
    for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length-width+i]) < 1e-4, `run seam: ${track.name}`);
  }
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Jump')).play();
  mixer.setTime(0);update(asset);
  const standing = asset.ankles.map(foot => foot.getWorldPosition(new Vector3()).y);
  mixer.setTime(.7);update(asset);
  asset.ankles.forEach((foot,i) => assert.ok(foot.getWorldPosition(new Vector3()).y > standing[i]+.35));
  mixer.setTime(1.499);update(asset);
  asset.ankles.forEach((foot,i) => assert.ok(Math.abs(foot.getWorldPosition(new Vector3()).y-standing[i]) < .02));
});


test('oval eyes stay seated on the face in open and blink poses', () => {
  const asset = createTravelerAsset(gltf.scene);
  update(asset);
  const ray = new Raycaster(), point = new Vector3();
  for (const amount of [0, 1]) {
    for (const { mesh, index } of asset.eyes) {
      mesh.morphTargetInfluences[index] = amount;
      const count = mesh.geometry.attributes.position.count;
      for (let i = 0; i < count; i += Math.ceil(count / 12)) {
        mesh.getVertexPosition(i, point);mesh.localToWorld(point);
        ray.set(new Vector3(point.x, point.y, -2), new Vector3(0, 0, 1));
        const hits = ray.intersectObjects(asset.grip.map(part => part.mesh), false);
        assert.ok(hits.length > 0, 'eye must have skin directly behind it');
        assert.ok(hits[0].point.z - point.z < .007, 'eye should not float ahead of face');
      }
    }
  }
});


test('gameplay motion driver restores the ground pose after jumping and running', () => {
  const asset = createTravelerAsset(gltf.scene);
  const driver = createTravelerMotion(asset.scene,gltf.animations);
  const root = asset.scene.getObjectByName('root');
  const start = root.position.clone();
  driver.sample('Jump',.7);
  assert.ok(root.position.y > start.y+.35);
  driver.reset();
  assert.ok(root.position.distanceTo(start)<1e-6);
  driver.sample('Run',.21);driver.reset();
  assert.ok(root.position.distanceTo(start)<1e-6);
  driver.sample('Jump',1.5);driver.reset();
  assert.ok(root.position.distanceTo(start)<1e-6);
});

test('motion smoothing softens pose switches and settles without residual jump height', () => {
  const asset = createTravelerAsset(gltf.scene);
  const driver = createTravelerMotion(asset.scene, gltf.animations);
  const root = asset.scene.getObjectByName('root');
  const start = root.position.y;
  driver.smooth(1/60);
  driver.reset();
  driver.sample('Jump', .7);
  const target = root.position.y;
  driver.smooth(1/60);
  assert.ok(root.position.y > start && root.position.y < target - .1);
  for (let i=0; i<60; i++) { driver.reset(); driver.smooth(1/60); }
  assert.ok(Math.abs(root.position.y-start)<1e-6);
});

test('exported run and jump have continuous foot motion at 60 fps', () => {
  for (const name of ['Run', 'Jump']) {
    const asset = createTravelerAsset(gltf.scene);
    const driver = createTravelerMotion(asset.scene, gltf.animations);
    const duration = gltf.animations.find(clip=>clip.name===name).duration;
    let previous;
    for(let t=0; t<duration; t+=1/60) {
      driver.reset(); driver.sample(name,t); update(asset);
      const feet = asset.ankles.map(foot=>foot.getWorldPosition(new Vector3()));
      if(previous) feet.forEach((foot,i)=>assert.ok(foot.distanceTo(previous[i])<.09, `${name} foot discontinuity at ${t}`));
      previous=feet;
    }
  }
});

test('Relief keeps feet planted, relaxes the shoulders and blends back to gameplay', () => {
  const asset = createTravelerAsset(gltf.scene);
  const driver = createTravelerMotion(asset.scene, gltf.animations);
  const clip = gltf.animations.find(clip=>clip.name==='Relief');
  assert.equal(clip.duration, 2);
  driver.sample('Relief',0); update(asset);
  const planted = asset.ankles.map(foot=>foot.getWorldPosition(new Vector3()));
  const startLean = asset.body.rotation.x;
  const startSpread = Math.abs(asset.arms[0].rotation.z);
  for(let frame=1;frame<=120;frame++) {
    driver.reset();driver.sample('Relief',frame/60);update(asset);
    asset.ankles.forEach((foot,i)=>assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(planted[i])<.002,'feet slide during relief'));
  }
  assert.ok(Math.abs(asset.body.rotation.x)<Math.abs(startLean)*.1);
  assert.ok(Math.abs(asset.arms[0].rotation.z)<startSpread*.3);
  driver.reset();
  asset.body.rotation.x=.25;
  driver.sample('Relief',2,0);
  assert.ok(Math.abs(asset.body.rotation.x-.25)<1e-6,'zero weight must preserve gameplay pose');
  driver.reset();
  assert.ok(Math.abs(asset.scene.getObjectByName('head').rotation.x)<1e-6);
});

test('relief blink eases closed during exhale and opens before recovery', () => {
  assert.equal(reliefBlink(undefined),0);
  assert.equal(reliefBlink(0),0);
  assert.equal(reliefBlink(.58),1);
  assert.equal(reliefBlink(1.1),0);
  assert.ok(reliefBlink(.45)>0 && reliefBlink(.45)<1);
});

test('running contacts stay fixed in world space at loaded and unburdened speeds', () => {
  for (const speed of [1.65*1.75, 2.5*1.75]) {
    for(const heading of [0, Math.PI/2, -.6]) {
      const asset = createTravelerAsset(gltf.scene);
      const driver = createTravelerMotion(asset.scene,gltf.animations);
      asset.scene.rotation.y=heading;
      for(const [foot,offset] of [[0,0],[1,.5]]) {
        let planted;
        // Sample the central stance interval after the state transition.
        for(let t=.04*1.6/speed;t<.31*1.6/speed;t+=1/120) {
          const distance=offset*1.6+t*speed;
          driver.reset();driver.sampleRun(distance);driver.smooth(1/120);
          asset.scene.position.set(-Math.sin(heading)*distance,0,-Math.cos(heading)*distance);
          update(asset);
          const position=asset.ankles[foot].getWorldPosition(new Vector3());
          if(planted) assert.ok(position.distanceTo(planted)<.012, `foot slides ${position.distanceTo(planted)}m at speed ${speed}`);
          else planted=position;
        }
      }
    }
  }
});

test('standing, walking and running jumps share an arc and recover into their live gait', () => {
 for(const blend of [0,.5,1]) {
  const asset=createTravelerAsset(gltf.scene),driver=createTravelerMotion(asset.scene,gltf.animations);
  const root=asset.scene.getObjectByName('root');
  let last;
  for(let frame=0;frame<=90;frame++) {
   const t=frame/60;
   driver.reset();
   driver.sampleJump(t,t*2.8875,blend,blend===1);
   update(asset);
   const feet=asset.ankles.map(foot=>foot.getWorldPosition(new Vector3()));
   if(last) feet.forEach((foot,i)=>assert.ok(foot.distanceTo(last[i])<.17,'jump frame discontinuity'));
   if(frame===36) assert.ok(root.position.y>.43,'jump apex must be preserved at every blend weight');
   last=feet;
  }
  const endHeight=root.position.y;
  driver.reset();
  if(blend===1) driver.sampleRun(1.5*2.8875);
  assert.ok(Math.abs(endHeight-root.position.y)<1e-5,'jump must recover to the current ground gait');
  driver.reset();
 }
});
