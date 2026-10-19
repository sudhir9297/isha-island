import { stepStartupSequence } from '../StartupSequence.js';
import { createStartupReveal } from './StartupReveal.js';
import { useEffect, useRef } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { RenderPipeline, ClippingGroup } from 'three/webgpu';
import { pass, uv, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js';

extend({ ClippingGroup });

export default function GameRendering({ quality, onError, startup, assetsReady, onStartup, boatState, journey }) {
  const state = useThree();
  const { gl, scene, camera, advance } = state;
  const pipeline = useRef(null);
  useEffect(() => {
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomPass = bloom(sceneColor, 0.06, 0, 1.35);
    bloomPass.smoothWidth.value = 1;
    const strength = uv().y.sub(0.5).abs().smoothstep(0.32, 0.5);
    const blurred = hashBlur(sceneColor, strength.mul(0.0015), { repeats: 25, premultipliedAlpha: true });
    const renderer = new RenderPipeline(gl);
    const high = mix(sceneColor, blurred, strength).add(bloomPass);
    const balanced = sceneColor.add(bloomPass);
    const reveal = createStartupReveal(scenePass, camera);
    const introHigh = reveal.wrap(high), introBalanced = reveal.wrap(balanced);
    renderer.outputNode = introHigh;
    pipeline.current = { renderer, high, balanced, introHigh, introBalanced, reveal };
    return () => {
      pipeline.current = null;
      renderer.dispose();
      scenePass.dispose();
      bloomPass.dispose();
    };
  }, [gl, scene, camera]);
  useEffect(() => {
    const active = pipeline.current;
    if (!active) return;
    const complete = startup.current.phase === 'complete';
    active.renderer.outputNode = quality === 'high' ? (complete ? active.high : active.introHigh) : (complete ? active.balanced : active.introBalanced);
    active.renderer.needsUpdate = true;
  }, [gl, scene, camera, quality, startup]);
  useEffect(() => {
    let previous = null, elapsed = 0, failed = false;
    gl.setAnimationLoop((milliseconds) => {
      if (failed) return;
      const delta = previous === null || document.hidden ? 0 : Math.min((milliseconds - previous) / 1000, 1 / 30);
      previous = milliseconds;
      elapsed += Math.max(0, delta);
      try {
        advance(elapsed, true);
      }
      catch (error) {
        failed = true;
        console.error('Port renderer failed:', error);
        onError?.('The renderer could not draw the island. Please reload or try another browser.');
      }
    });
    return () => { gl.setAnimationLoop(null); };
  }, [gl, advance, onError]);
  useFrame(({ camera: frameCamera }, delta) => {
    const active = pipeline.current;
    if (!active) return;
    const sequence = startup.current;
    if (sequence.phase === 'complete') return;
    const previous = sequence.phase;
    stepStartupSequence(sequence, document.hidden ? 0 : delta, assetsReady, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (sequence.phase !== previous) onStartup(sequence.phase);
    // CameraRig establishes the gameplay camera earlier in this same frame.
    if (sequence.phase !== 'complete') {
      frameCamera.zoom *= sequence.zoom;
      frameCamera.updateProjectionMatrix();
      frameCamera.updateMatrixWorld();
    }
    const focus = journey.current.mode === 'aboard' ? boatState.current.position : journey.current.position;
    active.reveal.update(sequence, focus);
    if (sequence.phase === 'complete' && previous !== 'complete') {
      active.renderer.outputNode = quality === 'high' ? active.high : active.balanced;
      active.renderer.needsUpdate = true;
    }
  }, .6);
  useFrame(() => pipeline.current?.renderer.render(), 1);
  return null;
}
