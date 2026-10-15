import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const TRAVELER_ASSET = '/models/sankaran-pillai.glb';

// Each instance needs its own bones and skeleton, while geometry/materials remain
// shared with the GLTF cache. All exported bone axes match the game's Y-up basis.
export function createTravelerAsset(source) {
  const scene = clone(source);
  const required = name => {
    const object = scene.getObjectByName(name);
    if (!object) throw new Error(`Sankaran character is missing ${name}`);
    return object;
  };
  const pair = name => ['L', 'R'].map(side => required(`${name}${side}`));
  const garment = required('Dhoti');
  let influences;
  garment.traverse(object => {
    if (object.morphTargetInfluences) {
      influences ??= object.morphTargetInfluences;
      object.morphTargetInfluences = influences;
    }
  });
  if (!influences) throw new Error('Sankaran character is missing the seated cloth shape');
  garment.morphTargetInfluences = influences;
  const grip = [], eyes = [];
  scene.traverse(object => {
    if (object.morphTargetDictionary?.Blink !== undefined) {
      eyes.push({ mesh: object, index: object.morphTargetDictionary.Blink });
    }
    if (object.morphTargetDictionary?.CarryGrip !== undefined) {
      grip.push({ mesh: object, index: object.morphTargetDictionary.CarryGrip });
    }
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      // Bounds change with the game-driven skeleton and seated corrective.
      object.frustumCulled = false;
    }
  });
  return {
    scene, grip, eyes, body: required('body'), cloth: garment, harness: required('Harness'),
    hands: pair('hand'), arms: pair('upper_arm'), elbows: pair('forearm'), legs: pair('thigh'),
    knees: pair('shin'), ankles: pair('foot'),
  };
}
