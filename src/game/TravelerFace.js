// Short, eased blinks with an occasional second blink; seconds are monotonic.
export function blinkAmount(seconds) {
  const cycle = Math.floor(seconds / 4.6);
  const phase = seconds % 4.6;
  const blink = t => {
    if (t < 0 || t > .22) return 0;
    const u = t < .085 ? t / .085 : 1 - (t - .085) / .135;
    return u * u * (3 - 2 * u);
  };
  return Math.max(blink(phase - 3.8), cycle % 3 === 2 ? blink(phase - 4.15) : 0);
}

export function reliefBlink(seconds) {
  if (seconds == null || seconds < .32 || seconds > 1.05) return 0;
  const u = seconds < .58 ? (seconds-.32)/.26 : (1.05-seconds)/.47;
  return u*u*(3-2*u);
}

export function updateTravelerFace(eyes, seconds, reliefTime) {
  const amount = Math.max(blinkAmount(seconds), reliefBlink(reliefTime));
  for (const { mesh, index } of eyes) mesh.morphTargetInfluences[index] = amount;
}
