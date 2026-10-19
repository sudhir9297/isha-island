// Wind direction and layered, travelling gusts inspired by Bruno Simon's folio-2025.
export const WIND = Object.freeze({ angle: Math.PI * 0.6, strength: 0.55, duration: 4.7, poolSize: 4 });
export const windDirection = { x: Math.sin(WIND.angle), z: Math.cos(WIND.angle) };

export function advanceWind(time, delta, paused, reducedMotion) {
  return time + (paused || reducedMotion ? 0 : Math.max(0, Math.min(delta, 0.05)));
}

const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function windRibbonWidth(ratio, progress) {
  // A tapered ribbon with a pulse travelling from its tail to its head.
  return smooth(1 - Math.abs(ratio - 0.5) * 2) * smooth(1 - Math.abs(ratio - (progress * 3 - 1)));
}

export function createWindLines() {
  return { next: 0.4, lines: Array.from({ length: WIND.poolSize }, () => ({ active: false, age: 0, x: 0, y: 0, z: 0, length: 1 })) };
}

export function stepWindLines(state, delta, focus, groundAt, random = Math.random) {
  if (delta <= 0) return;
  for (const line of state.lines) {
    if (line.active) {
      line.age += delta;
      if (line.age >= WIND.duration) line.active = false;
    }
  }
  state.next -= delta;
  if (state.next > 0) return;
  const line = state.lines.find(item => !item.active);
  if (!line) return;
  const x = focus.x + (random() - 0.5) * 20;
  const z = focus.z + (random() - 0.5) * 20;
  Object.assign(line, { active: true, age: 0, x, z, y: Math.max(0, groundAt(x, z)) + 1.8 + random() * 1.2, length: 0.65 + random() * 0.55 });
  state.next = 0.5 + random() * 1.5;
}
