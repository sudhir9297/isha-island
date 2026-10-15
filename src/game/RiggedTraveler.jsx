import { Suspense, useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { updateTravelerFace } from './TravelerFace.js';
import { createTravelerMotion } from './TravelerMotion.js';
import { useGLTF } from '@react-three/drei';
import { createTravelerAsset, TRAVELER_ASSET } from './TravelerAsset.js';

function Character({ journey, legs, knees, ankles, arms, hands, grip, elbows, body, harness, cloth, motion }) {
  const { scene, animations } = useGLTF(TRAVELER_ASSET);
  const asset = useMemo(() => {
    const instance = createTravelerAsset(scene);
    instance.motion = createTravelerMotion(instance.scene, animations);
    return instance;
  }, [scene, animations]);
  useFrame(({ clock }) => updateTravelerFace(asset.eyes, clock.elapsedTime, journey?.current.released ? journey.current.releaseTime : undefined));
  useLayoutEffect(() => {
    const refs = { legs, knees, ankles, arms, hands, grip, elbows, body, harness, cloth, motion };
    for (const [name, ref] of Object.entries(refs)) ref.current = asset[name];
    return () => {
      for (const [name, ref] of Object.entries(refs)) {
        if (ref.current === asset[name]) ref.current = Array.isArray(asset[name]) ? [] : null;
      }
    };
  }, [asset, legs, knees, ankles, arms, hands, grip, elbows, body, harness, cloth, motion]);
  return <primitive object={asset.scene} dispose={null} />;
}

export default function RiggedTraveler(props) {
  return <Suspense fallback={null}><Character {...props} /></Suspense>;
}

useGLTF.preload(TRAVELER_ASSET);
