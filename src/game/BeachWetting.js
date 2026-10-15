import { beachNodes } from './rendering/SurfaceNodes.js';
import { Vector2, Vector4 } from "three";
import { createSeabedFieldTexture, SEABED_GRID, SEABED_GLSL, SEABED_MAX_Y } from "./Seabed.js";
import { SEABED_Y } from "./WorldConfig.js";
import { OCEAN_SEA_LEVEL, WATER_OPTICS_GLSL } from "./WaterOptics.js";

let shaderHash = 0;
for (let i = 0; i < WATER_OPTICS_GLSL.length; i++) shaderHash = Math.imul(shaderHash, 31) + WATER_OPTICS_GLSL.charCodeAt(i) | 0;
export const BEACH_WETTING_KEY = `beach-wetting-1-${shaderHash}`;

// Wetness follows the rendered swash, with a short drying memory. Geometry,
// authored vertex colors, sand grain and the physical shoreline stay unchanged.
export function createBeachWetting() {
  const field = createSeabedFieldTexture();
  const uniforms = {
    uBeachTime: { value: 0 },
    uSeabedField: { value: field },
    uSeabedGrid: { value: new Vector4(SEABED_GRID.x, SEABED_GRID.z, SEABED_GRID.step, SEABED_Y) },
    uSeabedSize: { value: new Vector2(SEABED_GRID.columns, SEABED_GRID.rows) },
    uSeabedMaxHeight: { value: SEABED_MAX_Y },
  };
  return {
    uniforms,
    nodes: beachNodes(uniforms),
    advance(time) { uniforms.uBeachTime.value = time; },
    dispose() { field.dispose(); },
    apply(shader) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = "varying vec3 beachWorld;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n beachWorld = (modelMatrix * vec4(transformed, 1.)).xyz;",
      );
      shader.fragmentShader = `varying vec3 beachWorld;
        uniform float uBeachTime;
        ${SEABED_GLSL}
        ${WATER_OPTICS_GLSL}
        float beachWetness(float waterY) {
          return 1. - smoothstep(.004, .032, beachWorld.y - waterY);
        }
        float beachSwashWetness() {
          if (beachWorld.y > ${OCEAN_SEA_LEVEL + 0.12}) return 0.;
          vec3 bed = seabedSample(beachWorld.xz);
          float waterNow = ${OCEAN_SEA_LEVEL} + waterSurface(beachWorld.xz, uBeachTime, bed).x;
          float waterRecent = ${OCEAN_SEA_LEVEL} + waterSurface(beachWorld.xz, uBeachTime - 1.2, bed).x;
          float waterOlder = ${OCEAN_SEA_LEVEL} + waterSurface(beachWorld.xz, uBeachTime - 2.4, bed).x;
          return max(beachWetness(waterNow), max(.78 * beachWetness(waterRecent), .56 * beachWetness(waterOlder)));
        }
      ` + shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n float beachWet = beachSwashWetness();\n diffuseColor.rgb *= mix(1., .86, beachWet);",
      ).replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .56, beachWet);",
      );
    },
  };
}
