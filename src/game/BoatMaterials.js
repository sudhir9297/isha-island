import { Color, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RGBAFormat } from "three";

// A broad daylight sky and darker water hemisphere give varnish and metal a
// reflected environment. Values are linear radiance, matching the scene lights.
export function createBoatReflection() {
  const width = 128, height = 64, pixels = new Float32Array(width * height * 4);
  const zenith = new Color("#a5cbd8"), horizon = new Color("#f0e4cc"), sea = new Color("#268e9c");
  const sun = [22, 28, -22], length = Math.hypot(...sun);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const theta = (1 - (y + 0.5) / height) * Math.PI;
    const phi = ((x + 0.5) / width - 0.5) * Math.PI * 2;
    const dy = Math.cos(theta), dx = Math.sin(theta) * Math.cos(phi), dz = Math.sin(theta) * Math.sin(phi);
    const sky = horizon.clone().lerp(zenith, Math.pow(Math.max(0, dy), 0.65));
    if (dy < 0) sky.lerp(sea, Math.min(1, -dy * 7));
    const alignment = (dx * sun[0] + dy * sun[1] + dz * sun[2]) / length;
    const cloud = Math.exp((alignment - 1) * 18) * 0.48;
    const i = (y * width + x) * 4;
    pixels[i] = sky.r * 0.55 + cloud;
    pixels[i + 1] = sky.g * 0.55 + cloud * 0.93;
    pixels[i + 2] = sky.b * 0.55 + cloud * 0.79;
    pixels[i + 3] = 1;
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
