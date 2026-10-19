import { gateStoneColor } from './rendering/SurfaceNodes.js';
import { gateGround } from "./MalaiVasalGeometry.js";
import { GATE } from "./GateTerrain.js";

export const MALAI_VASAL_ASSET = "/models/malai-vasal-day-v2-compressed.glb";

// Keep the V2 sculpture, but give it the same sun-washed palette as the island.
// Baked stone contributes restrained grain; the crown boulder stays neutral gray.
function islandMaterial(source) {
  const material = source.clone();
  const name = source.name;
  let color = "#d4c395";
  material.roughness = 0.88;
  material.metalness = 0;
  // The fine protective net in the detailed source aliases at game distance.
  if (/retaining wire/i.test(name)) material.visible = false;
  if (/Source baked/.test(name)) {
    color = /Boulder/.test(name) ? "#968b80" : "#e0cdb0";
    material.bumpMap = source.map;
    material.bumpScale = /Boulder/.test(name) ? 0.022 : 0.012;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying float vStoneNormalY;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvStoneNormalY = objectNormal.y;");
      shader.fragmentShader = "varying float vStoneNormalY;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec4 stoneSample = texture2D(map, vMapUv);
          float grain = dot(stoneSample.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb *= mix(0.9, 1.06, smoothstep(0.08, 0.7, grain));
        #endif
        diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(-0.6, 0.2, vStoneNormalY));
      `);
    };
    material.color.set(color);
    material.colorNode = gateStoneColor(material);
    material.customProgramCacheKey = () => "island-stone-grain-v3";
  } else if (/Laterite brick/.test(name)) {
    const tones = ["#bb805e", "#cf9771", "#b97d60", "#c48a68", "#d5a07c", "#bb8972"];
    color = tones[Number(name.slice(-1)) % tones.length];
  } else if (/brick courses/i.test(name)) color = "#bb8972";
  else if (/Brick joints/.test(name)) color = "#918375";
  else if (/Finial/.test(name)) {
    color = "#c9aa62";
    material.metalness = 0.38;
    material.roughness = 0.43;
  } else if (/iron|wire/i.test(name)) {
    color = /edges/i.test(name) ? "#666969" : "#353d3e";
    material.metalness = 0.25;
    material.roughness = 0.64;
  } else if (/cracks/.test(name)) color = "#837179";
  else if (/chips/.test(name)) color = "#ecddc4";
  else if (/Granite edge/.test(name)) color = "#b49e98";
  if (/Pale warm granite/.test(name)) color = "#e4d2b6";
  material.color.set(color);
  return material;
}

const ownedResources = new WeakMap();

export function placeGateAsset(source) {
  const scene = source.clone(true);
  const geometries = new Set(), materials = new Map();
  const getMaterial = (sourceMaterial) => {
    if (!materials.has(sourceMaterial)) materials.set(sourceMaterial, islandMaterial(sourceMaterial));
    return materials.get(sourceMaterial);
  };
  ownedResources.set(scene, { geometries, materials });
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material) ? object.material.map(getMaterial) : getMaterial(object.material);
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
      // Only deformable wings need private buffers; static sculpture uses the loader cache.
      object.geometry = object.geometry.clone();
      geometries.add(object.geometry);
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
  const owned = ownedResources.get(scene);
  if (!owned) return;
  owned.geometries.forEach(geometry => geometry.dispose());
  owned.materials.forEach(material => material.dispose());
  ownedResources.delete(scene);
}
