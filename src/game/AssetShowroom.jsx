import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import { createTravelerAsset, TRAVELER_ASSET } from './TravelerAsset.js';
import { placeCarriedBag, setCarryingArms, updateTravelerGrip } from './LuggageCarry.js';
import { updateTravelerFace } from './TravelerFace.js';
import { RUN_CYCLE_DISTANCE } from './TravelerRun.js';
import { Luggage } from './TravelerModels.jsx';

function DressedTraveler({ motion, showBags, replay }) {
  const gltf = useGLTF(TRAVELER_ASSET);
  const asset = useMemo(() => createTravelerAsset(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(asset.scene), [asset.scene]);
  const bags = useRef([]);
  const carrying = showBags && motion !== 'Relief';
  const sceneRef = useRef(asset);
  const previousAction = useRef(null);
  useEffect(() => () => mixer.stopAllAction(), [mixer]);
  useEffect(() => {
    sceneRef.current = asset;
    const action = mixer.clipAction(gltf.animations.find(clip => clip.name === motion));
    action.setLoop(['Jump','JumpRun','Relief'].includes(motion) ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = ['Jump','JumpRun','Relief'].includes(motion);
    action.reset().setEffectiveTimeScale(motion === 'Run' ? (1.65*1.75)/RUN_CYCLE_DISTANCE*action.getClip().duration : 1).play();
    if (previousAction.current && previousAction.current !== action) {
      action.crossFadeFrom(previousAction.current, .18, false);
    }
    previousAction.current = action;
  }, [asset, mixer, gltf.animations, motion, replay]);
  useFrame(({ clock }, delta) => {
    mixer.update(Math.min(delta, .05));
    const asset = sceneRef.current;
    updateTravelerFace(asset.eyes, clock.elapsedTime, motion === 'Relief' ? previousAction.current?.time : undefined);
    asset.harness.visible = carrying;
    updateTravelerGrip(asset.grip, carrying, delta);
    if (carrying) setCarryingArms(asset.arms);
    asset.scene.updateMatrixWorld(true);
    bags.current.forEach((bag, i) => {
      if (!bag) return;
      placeCarriedBag(bag, i, asset.body, asset.hands, asset.scene);
    });
  });
  return <group position={[-1.15, .08, 0]}>
    <primitive object={asset.scene} dispose={null} />
    {[0, 1, 2, 3].map(i => <group key={i} ref={el => { bags.current[i] = el; }} visible={carrying} rotation={[0, i === 1 ? Math.PI : 0, 0]}><Luggage variant={i} /></group>)}
  </group>;
}

const displays = [
  { name: 'Terracotta suitcase', x: 1, z: -.65, height: .54 },
  { name: 'Sage backpack', x: 2.05, z: -.65, height: .55 },
  { name: 'Ochre duffel', x: 1, z: .65, height: .41 },
  { name: 'Indigo satchel', x: 2.05, z: .65, height: .385 },
];
function Stage({ motion, showBags, rotate, portrait, replay }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (portrait) {
      camera.position.set(-1.05, 2.05, -2);
      camera.lookAt(-1.15, 1.93, 0);
      return;
    }
    const distance = Math.max(1, 1.35 / (size.width / size.height));
    camera.position.set(.2 - distance, 1.05 + 2.05 * distance, -7.2 * distance);
    camera.lookAt(.2, 1.05, 0);
  }, [camera, size.width, size.height, portrait]);
  return <>
    <color attach="background" args={['#e8e4dc']} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[-3, 7, -5]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-normalBias={.025} />
    <directionalLight position={[4, 3, 3]} intensity={1.5} />
    <DressedTraveler motion={motion} showBags={showBags} replay={replay} />
    {displays.map((item, i) => <group key={item.name} position={[item.x, 0, item.z]}>
      <mesh position={[0, .12, 0]} receiveShadow><cylinderGeometry args={[.43, .45, .24, 48]} /><meshStandardMaterial color="#d4cbbc" roughness={.9} /></mesh>
      <group position={[0, item.height, 0]}><Luggage variant={i} /></group>
      <Html position={[0, .02, -.5]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: 12, color: '#514a40', background: '#fff9', padding: '5px 9px', borderRadius: 8 }}>{item.name}</Html>
    </group>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.005, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e8e4dc" roughness={1} /></mesh>
    <OrbitControls makeDefault target={portrait ? [-1.15, 1.93, 0] : [.2, 1.05, 0]} minDistance={2} maxDistance={12} maxPolarAngle={Math.PI / 2 - .025} autoRotate={rotate} autoRotateSpeed={.7} />
  </>;
}

export default function AssetShowroom() {
  const [portrait, setPortrait] = useState(false);
  const [replay, setReplay] = useState(0);
  const [motion, setMotion] = useState('Idle');
  const [showBags, setShowBags] = useState(true);
  const [rotate, setRotate] = useState(false);
  const button = { padding: '10px 14px', borderRadius: 9, border: '1px solid #a79e90', background: '#fff', color: '#302e28', cursor: 'pointer' };
  return <main style={{ position: 'fixed', inset: 0, background: '#e8e4dc', color: '#302e28' }}>
    <header style={{ position: 'absolute', top: 22, left: 26, zIndex: 2, pointerEvents: 'none' }}><h1 style={{ fontSize: 25, margin: '0 0 6px' }}>Traveler & luggage</h1><p style={{ margin: 0 }}>Drag to orbit · Scroll to zoom · Right-drag to pan</p></header>
    <button style={{ ...button, position: 'absolute', top: 95, left: 26, zIndex: 3 }} onClick={() => setPortrait(v => !v)}>{portrait ? 'Show full scene' : 'Inspect face'}</button>
    <Canvas shadows camera={{ position: [-.8, 3.1, -7.2], fov: 39 }} dpr={[1, 2]}>
      <Suspense fallback={<Html center>Loading character and bags…</Html>}><Stage motion={motion} showBags={showBags} rotate={rotate} portrait={portrait} replay={replay} /></Suspense>
    </Canvas>
    <nav aria-label="Preview controls" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: '95%', gap: 10, zIndex: 2, whiteSpace: 'nowrap' }}>
      <label style={{ ...button, display: 'flex', gap: 8, alignItems: 'center' }}>Animation<select aria-label="Animation" value={motion} onChange={e => setMotion(e.target.value)}>{['Idle','Walk','Run','Jump','JumpRun','Relief'].map(name => <option key={name} value={name}>{name === 'JumpRun' ? 'Running jump' : name === 'Jump' ? 'Standing jump' : name}</option>)}</select></label>
      {['Jump','JumpRun','Relief'].includes(motion) && <button style={button} onClick={() => setReplay(v => v + 1)}>Replay {motion === 'JumpRun' ? 'running jump' : motion === 'Jump' ? 'standing jump' : motion.toLowerCase()}</button>}
      {motion !== 'Relief' && <button style={button} onClick={() => setShowBags(v => !v)} aria-pressed={showBags}>{showBags ? 'Remove carried bags' : 'Attach bags'}</button>}
      <button style={button} onClick={() => setRotate(v => !v)} aria-pressed={rotate}>{rotate ? 'Stop rotation' : 'Rotate scene'}</button>
      <a style={{ ...button, textDecoration: 'none' }} href="/?debug">Back to game</a>
    </nav>
  </main>;
}
