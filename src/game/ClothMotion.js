const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function easeClothForce(current, target, delta) {
  return current + (clamp(target, -1.2, 1.2) - current) * -Math.expm1(-5 * Math.max(0, delta));
}

// Waves take longer to reach a loose edge. The anchored edge has zero displacement.
export function clothRipple(weight, across, time, force, phase) {
  const delayed = time - weight * .32;
  const envelope = weight * weight;
  const flutter = Math.sin(delayed * 7.1 - weight * 8 + across * 3 + phase);
  const billow = Math.sin(delayed * 2.2 - weight * 3.4 + phase);
  return envelope * force * (.045 * billow + .018 * flutter);
}

export function canopyDisplacement(x, z, time, strength) {
  const u = clamp((x + .74) / 1.48, 0, 1), v = clamp((z + .47) / 1.6, 0, 1);
  const perimeter = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  // Two transverse support bars and the outside rails remain fixed.
  const supports = clamp(Math.abs(z + .33) / .18, 0, 1) * clamp(Math.abs(z - 1) / .18, 0, 1);
  return perimeter * supports * strength * (.009 + .007 * Math.sin(time * 2.3 - z * 5 + x * 2));
}

export function pennantY(x, y, width, height) {
  const along = clamp(-y / height, 0, 1);
  const notch = 1 - Math.abs(x) / (width / 2);
  return y + height * .23 * Math.max(0, notch) * along ** 3;
}
