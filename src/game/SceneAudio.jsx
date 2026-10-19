import { useWindField } from './WindContext.js';
import {useRef, useEffect} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3} from 'three';

export default function SceneAudio({audio, boatState, journey, paused}) {
  const wind = useWindField();
  const state = useRef({elapsed: 0, birdTime: 5, direction: new Vector3()});
  useEffect(() => {
    const quietWhenHidden = () => {
      if (!document.hidden) return;
      const traveler = journey.current;
      const position = traveler.mode === 'aboard' ? boatState.current.position : traveler.position;
      audio.wind(position, wind.weather.wind, wind.time.value, true);
    };
    document.addEventListener('visibilitychange', quietWhenHidden);
    return () => document.removeEventListener('visibilitychange', quietWhenHidden);
  }, [audio, journey, boatState, wind]);
  useFrame(({camera}, delta) => {
    const traveler = journey.current, boat = boatState.current;
    const position = traveler.mode === 'aboard' ? boat.position : traveler.position;
    if (paused || document.hidden) { audio.wind(position, wind.weather.wind, wind.time.value, true); return; }
    const current = state.current;
    current.elapsed += delta; current.birdTime -= delta;
    if (current.elapsed < .1) return;
    current.elapsed = 0;
    audio.wind(position, wind.weather.wind, wind.time.value, false);
    camera.getWorldDirection(current.direction);
    audio.spatial(position, current.direction, boat.position, traveler.released);
    if (current.birdTime <= 0) {
      current.birdTime = 7 + Math.random() * 6;
      audio.bird({x: -6.7, y: 3.2, z: -8.8});
    }
  });
  return null;
}
