import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from "three";

/** Stern turbulence, a torn ribbon, a broken ring, and separated foam lobes. */
export function createFoamTexture() {
  const cellSize = 128, size = cellSize * 2;
  const pixels = new Uint8Array(size * size * 4);
  const fract = (value) => value - Math.floor(value);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = fract(x), fy = fract(y);
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy)
      + (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy;
  };
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const tile = Math.floor(x / cellSize) + Math.floor(y / cellSize) * 2;
    const u = (x % cellSize / (cellSize - 1)) * 2 - 1;
    const v = (y % cellSize / (cellSize - 1)) * 2 - 1;
    const n = noise(u * 2.1 + tile * 7.3, v * 2.6 + tile * 13.1);
    const fine = noise(u * 6.3 + tile * 3.7, v * 6.1);
    const angle = Math.atan2(v, u);
    const radius = Math.hypot(u * (1.08 + tile * .045), v * .91);
    const boundary = .7 + Math.sin(angle * 3 + tile * 1.9) * .11
      + Math.sin(angle * 5 - tile * .8) * .055 + (n - .5) * .19;
    let silhouette = 1 - smooth(boundary - .055, boundary + .035, radius);
    // These openings are large enough to survive the game's camera distance.
    // Fine bubbles sit inside broad films instead of defining their silhouette.
    const holes = smooth(.32, .58, n);
    const wetRims = Math.exp(-(((n - .43) / .115) ** 2));
    let film = Math.max(holes * (.62 + fine * .22), wetRims * .88);
    if (tile === 1) {
      const channel = u - Math.sin(v * 4.2 + .7) * .25;
      const ribbon = 1 - smooth(.22 + n * .16, .3 + n * .16, Math.abs(channel));
      silhouette = ribbon * (1 - smooth(.67, .92, Math.abs(v)))
        * (.24 + smooth(.26, .57, n) * .76);
      film = .6 + fine * .28;
    } else if (tile === 2) {
      const ring = Math.exp(-(((radius - boundary + .15) / .135) ** 2));
      silhouette *= ring * smooth(.22, .49, n);
      film = .72 + fine * .18;
    } else if (tile === 3) {
      silhouette *= smooth(.29, .5, n);
    }
    const grain = .88 + smooth(.2, .62, fine) * .12;
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(silhouette * film * grain * 255);
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export const foamVertex = `
attribute float instanceFade;
attribute float instanceSeed;
varying vec2 vUv;
varying float vFade;
varying float vSeed;
void main() {
  vUv = uv;
  vFade = instanceFade;
  vSeed = instanceSeed;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const foamFragment = `
uniform sampler2D uFoam;
varying vec2 vUv;
varying float vFade;
varying float vSeed;
void main() {
  float tile = floor(vSeed * 3.999);
  vec2 cell = vec2(mod(tile, 2.), floor(tile / 2.));
  vec2 sampleUv = vUv + vec2(sin(vUv.y*9.+vSeed*31.)*.025, 0.);
  float alpha = texture2D(uFoam, (cell + sampleUv)*.5).a * vFade;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(vec3(0.78, 0.9, 0.83), alpha);
  #include <colorspace_fragment>
}
`;
