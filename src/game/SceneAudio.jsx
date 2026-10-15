import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3} from 'three';

export default function SceneAudio({audio, boatState, journey, paused}) {
  const state = useRef({elapsed: 0, birdTime: 5, direction: new Vector3()});
  useFrame(({camera}, delta) => {
    if (paused || document.hidden) return;
    const current = state.current;
    current.elapsed += delta; current.birdTime -= delta;
    if (current.elapsed < .1) return;
    current.elapsed = 0;
    const traveler = journey.current, boat = boatState.current;
    const position = traveler.mode === 'aboard' ? boat.position : traveler.position;
    camera.getWorldDirection(current.direction);
    audio.spatial(position, current.direction, boat.position, traveler.released);
    if (current.birdTime <= 0) {
      current.birdTime = 7 + Math.random() * 6;
      audio.bird({x: -6.7, y: 3.2, z: -8.8});
    }
  });
  return null;
}
