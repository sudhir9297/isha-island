import {useEffect, useRef, useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {createQualityMonitor, resetQualityWindow, sampleQuality} from './AdaptiveQuality.js';

export default function AutoQuality({mode, quality, enabled, paused, onChange}) {
  const [initialMonitor] = useState(createQualityMonitor);
  const monitor = useRef(initialMonitor);
  useEffect(() => {
    monitor.current = createQualityMonitor();
    if (mode !== 'auto') onChange(mode);
  }, [mode, onChange]);
  useEffect(() => {
    const reset = () => { resetQualityWindow(monitor.current); monitor.current.warmup = 4; };
    document.addEventListener('visibilitychange', reset);
    return () => document.removeEventListener('visibilitychange', reset);
  }, []);
  useFrame((_, delta) => {
    if (mode !== 'auto' || !enabled || paused || document.hidden) {
      resetQualityWindow(monitor.current); return;
    }
    const next = sampleQuality(monitor.current, delta, quality);
    if (next) onChange(next);
  });
  return null;
}
