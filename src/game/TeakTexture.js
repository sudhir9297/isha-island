import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";

export function createTeakTexture() {
  const width = 256, height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width, v = y / height;
      const warp = Math.sin(u * Math.PI * 2) * 0.012
        + Math.sin(u * Math.PI * 6 + v * 5) * 0.004;
      // Four broad grain bands survive the seat's small projected depth.
      const grain = Math.sin((v + warp) * Math.PI * 8);
      const tone = Math.sin(u * Math.PI * 1.5 + v * 4);
      const pores = Math.sin(u * 117 + v * 223) * Math.sin(u * 257 - v * 127);
      const value = Math.round(241 + grain * 10 + tone * 2 + pores);
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value - 2;
      pixels[offset + 2] = value - 5;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, height);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
