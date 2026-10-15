// Source shaders for the build-time TSL generator.
export const glowVertex = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const glowFragment = `varying vec2 vUv; uniform float opacity;
void main() {
  float r = length((vUv - 0.5) * 2.0);
  float glow = exp(-r * r * 4.5) * (1.0 - smoothstep(0.55, 1.0, r));
  gl_FragColor = vec4(1.0, 0.68, 0.22, glow * opacity);
}`;
