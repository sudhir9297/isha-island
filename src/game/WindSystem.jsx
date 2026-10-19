/* eslint-disable react/immutability -- Shared Three.js uniforms are intentionally updated in effects and the frame loop. */
import { useEffect, useMemo } from 'react';
import { WindContext } from './WindContext.js';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { sampleWeather } from './Atmosphere.js';
import { advanceWind, WIND, windDirection } from './WindField.js';


export default function WindSystem({ paused, children }) {
  const field = useMemo(() => ({
    time: { value: 0 }, strength: { value: WIND.strength },
    direction: { value: new Vector3(windDirection.x, 0, windDirection.z) },
    reducedMotion: false, delta: 0, weather: sampleWeather(0),
    traveler: { value: new Vector3(0, -100, 0) }, interaction: { value: 0 },
  }), []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { field.reducedMotion = media.matches; field.strength.value = media.matches ? 0 : WIND.strength; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [field]);
  useFrame((_, delta) => {
    const next = advanceWind(field.time.value, delta, paused, field.reducedMotion);
    field.delta = next - field.time.value;
    field.time.value = next;
    sampleWeather(next, field.weather);
    field.strength.value = field.reducedMotion ? 0 : field.weather.wind;
  }, -1);
  return <WindContext.Provider value={field}>{children}</WindContext.Provider>;
}
