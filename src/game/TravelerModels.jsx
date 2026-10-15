import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

const LUGGAGE_ASSET = '/models/traveler-luggage.glb';
const LUGGAGE_NAMES = ['Luggage_Suitcase', 'Luggage_Backpack', 'Luggage_Duffel', 'Luggage_Satchel'];

function Bag({ variant }) {
  const { scene } = useGLTF(LUGGAGE_ASSET);
  const object = useMemo(() => {
    const source = scene.getObjectByName(LUGGAGE_NAMES[variant]);
    if (!source) throw new Error(`Missing luggage variant ${variant}`);
    const clone = source.clone(true);
    clone.traverse(child => {
      if (child.name === 'Satchel_FittedStrap') child.visible = false;
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });
    return clone;
  }, [scene, variant]);
  return <primitive object={object} dispose={null} />;
}

export function Luggage({ variant = 0 }) {
  return <Suspense fallback={null}><Bag variant={variant} /></Suspense>;
}

useGLTF.preload(LUGGAGE_ASSET);
