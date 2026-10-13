import { gateGround } from "./MalaiVasalGeometry.js";
import { GATE } from "./GateTerrain.js";

export const MALAI_VASAL_ASSET = "/models/malai-vasal-day-v2.glb";

// Keep the V2 sculpture, but give it the same sun-washed palette as the island.
// Baked stone contributes restrained grain rather than its original gray color.
function islandMaterial(source) {
  const material = source.clone();
  const name = source.name;
  let color = "#c8bd99";
  material.roughness = 0.88;
  material.metalness = 0;
  // The fine protective net in the detailed source aliases at game distance.
  if (/retaining wire/i.test(name)) material.visible = false;
  if (/Source baked/.test(name)) {
    color = /Boulder/.test(name) ? "#b1bd9d" : "#ded0aa";
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec4 stoneSample = texture2D(map, vMapUv);
          float grain = dot(stoneSample.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb *= mix(0.84, 1.12, smoothstep(0.08, 0.7, grain));
        #endif
      `);
    };
    material.customProgramCacheKey = () => "island-stone-grain-v1";
  } else if (/Laterite brick/.test(name)) {
    const tones = ["#cd9f79", "#d7ae80", "#c39772", "#d3a47d", "#ddb88c", "#cda780"];
    color = tones[Number(name.slice(-1)) % tones.length];
  } else if (/brick courses/i.test(name)) color = "#cda780";
  else if (/Brick joints/.test(name)) color = "#a28b68";
  else if (/Finial/.test(name)) {
    color = "#dfb94f";
    material.metalness = 0.38;
    material.roughness = 0.43;
  } else if (/iron|wire/i.test(name)) {
    color = /edges/i.test(name) ? "#697b69" : "#3f594f";
    material.metalness = 0.25;
    material.roughness = 0.64;
  } else if (/cracks/.test(name)) color = "#717867";
  else if (/chips/.test(name)) color = "#c7c19b";
  else if (/Granite edge/.test(name)) color = "#b7bd96";
  material.color.set(color);
  return material;
}

export function placeGateAsset(source) {
  const scene = source.clone(true);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material) ? object.material.map(islandMaterial) : islandMaterial(object.material);
    object.castShadow = true; object.receiveShadow = true;
    // Keep the authored horizontal masonry courses and stepped wall tops.
    // Only extend the buried footings to meet the hill; bending every vertex
    // to the terrain turns the straight walls and ironwork into curved ramps.
    let parent = object;
    let wing = false;
    while (parent) {
      if (/MalaiVasal_(Walls|Metalwork|StoneDetails)/.test(parent.name)) wing = true;
      parent = parent.parent;
    }
    if (wing) {
      const p = object.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
        // The source has a masonry joint at 5.727 on both wings. Lower the
        // entire outer bay together, including its grille and stone inserts.
        const drop = Math.abs(x) > 5.727 ? 1.15 : 0;
        p.setY(i, y - drop);
        if (Math.abs(x) > 4.98 && y < 0.025) {
          p.setY(i, Math.min(y - drop, gateGround(x, z) - GATE.floor - 0.06));
        }
      }
      p.needsUpdate = true; object.geometry.computeVertexNormals();
    }
    object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
  });
  return scene;
}
export function disposeGateAsset(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
