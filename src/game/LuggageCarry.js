import { Quaternion, Vector3 } from 'three';
const point = new Vector3(), offset = new Vector3(), rotation = new Quaternion(), parentRotation = new Quaternion();
const across = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const backwards = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

// Grip locations are the centers of the exported carry handles. Position the
// handle at the palm, rather than positioning the bag below an elbow estimate.
export function setBagCarryMode(bag, carried) {
  const fitted = bag.getObjectByName('Satchel_FittedStrap');
  const loose = bag.getObjectByName('Satchel_PropStrap');
  if (fitted) fitted.visible = carried;
  if (loose) loose.visible = !carried;
}

export function placeCarriedBag(bag, variant, body, hands, root) {
  if (variant === 3) setBagCarryMode(bag, true);
  if (variant === 0 || variant === 2) {
    const side = variant === 0 ? 0 : 1;
    point.set(side === 0 ? -.005 : .005, .005, -.02);
    hands[side].localToWorld(point);
    root.getWorldQuaternion(rotation);
    rotation.multiply(across); // narrow side faces the legs; the duffel runs fore/aft
    offset.set(0, variant === 0 ? .39 : .28, 0).applyQuaternion(rotation);
    point.sub(offset);
  } else {
    point.set(variant === 1 ? 0 : .06, variant === 1 ? 1.20 : .94, variant === 1 ? .51 : -.54);
    body.localToWorld(point);
    body.getWorldQuaternion(rotation);
    if (variant === 1) rotation.multiply(backwards);
  }
  bag.parent.worldToLocal(point);
  bag.position.copy(point);
  bag.parent.getWorldQuaternion(parentRotation).invert();
  bag.quaternion.copy(parentRotation.multiply(rotation));
}

export function setCarryingArms(arms) {
  arms.forEach((arm, side) => {
    arm.rotation.z = (side === 0 ? -1 : 1) * .32;
    arm.rotation.x *= .3;
  });
}

// A separate morph keeps the relaxed hands intact for seated/released poses.
export function updateTravelerGrip(grip, carrying, delta) {
  const target = carrying ? 1 : 0;
  const blend = 1 - Math.exp(-18 * delta);
  for (const { mesh, index } of grip) {
    mesh.morphTargetInfluences[index] += (target - mesh.morphTargetInfluences[index]) * blend;
  }
}
