import { BRUNO_TREE_MODEL } from './BrunoTreeGeometry.js';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MALAI_VASAL_ASSET } from './MalaiVasalAsset.js';
import { TRAVELER_ASSET } from './TravelerAsset.js';

// Shared loader cache: wait for both authored models without downloading twice.
export default function SceneStartup({ onReady, onError }) {
  useGLTF(MALAI_VASAL_ASSET);
  useGLTF(TRAVELER_ASSET);
  useGLTF(BRUNO_TREE_MODEL);
  const state = useRef({frames: 0, started: false, mounted: false});
  useEffect(() => {
    const current = state.current;
    current.mounted = true;
    return () => { current.mounted = false; };
  }, []);
  useFrame(({gl, scene, camera}) => {
    const current = state.current;
    if (current.started || ++current.frames < 3) return;
    current.started = true;
    // Let the model instances, custom materials and camera mount first. Normal
    // renders behind the overlay also initialize textures and the ocean pass.
    // The node renderer has already rendered the visible scene and both passes.
    // Its compileAsync walks every object sequentially, including hidden world
    // regions; repeating that work here delays startup without warming this view.
    const prepared = gl.isWebGPURenderer ? Promise.resolve() : gl.compileAsync(scene, camera);
    prepared.then(() => {
      if (current.mounted) onReady(true);
    }).catch(() => {
      if (current.mounted) onError('The island could not finish preparing. Please try again.');
    });
  });
  return null;
}
