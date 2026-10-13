import { BoxGeometry, SphereGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute } from "three";

export const MOTOR_POSITION = [0, 0.4, 1.85];
export const PROPELLER_POSITION = [0, -0.79, 0.265];
export const PROPELLER_RADIUS = 0.135;
const leg = new BoxGeometry(0.13, 0.86, 0.14);
const plate = new BoxGeometry(0.4, 0.035, 0.23);
const torpedo = new SphereGeometry(1, 12, 8);
torpedo.scale(0.072, 0.075, 0.16);
const hub = new CylinderGeometry(0.033, 0.026, 0.075, 12);
hub.rotateX(Math.PI / 2);
export const MOTOR_PARTS = [
  { geometry: leg, position: [0, -0.43, 0.05], color: "#154c41", metalness: 0.3 },
  { geometry: plate, position: [0, -0.65, 0.04], color: "#345d52", metalness: 0.4 },
  { geometry: torpedo, position: [0, -0.79, 0.10], color: "#154c41", metalness: 0.45 },
];
const blades = [], bladeIndices = [];
const outline = [[0.034, -0.014, -0.008], [0.118, -0.035, 0.007], [0.13, 0.02, 0.021], [0.059, 0.033, 0.014]];
for (let blade = 0; blade < 3; blade++) {
  const angle = blade * Math.PI * 2 / 3, c = Math.cos(angle), s = Math.sin(angle);
  for (const [x, y, z] of outline) blades.push(c * x - s * y, s * x + c * y, z);
  const i = blade * 4;
  bladeIndices.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
export const PROPELLER_GEOMETRY = new BufferGeometry();
PROPELLER_GEOMETRY.setAttribute("position", new Float32BufferAttribute(blades, 3));
PROPELLER_GEOMETRY.setIndex(bladeIndices);
PROPELLER_GEOMETRY.computeVertexNormals();
export const PROPELLER_HUB_GEOMETRY = hub;

function mergeParts(parts) {
  const positions = [], indices = [];
  for (const part of parts) {
    const geometry = part.geometry, p = geometry.attributes.position, offset = positions.length / 3;
    for (let i = 0; i < p.count; i++) positions.push(p.getX(i) + part.position[0], p.getY(i) + part.position[1], p.getZ(i) + part.position[2]);
    for (let i = 0; i < geometry.index.count; i++) indices.push(offset + geometry.index.getX(i));
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}
// The circumscribed prism contains every blade/hub phase. Its radial faces
// stay outside the rotating tips, including the space between angular vertices.
const propEnvelope = new CylinderGeometry(PROPELLER_RADIUS / Math.cos(Math.PI / 16), PROPELLER_RADIUS / Math.cos(Math.PI / 16), 0.09, 16);
propEnvelope.rotateX(Math.PI / 2);
export const MOTOR_RENDER_MESH = mergeParts(MOTOR_PARTS);
export const MOTOR_CONTACT_MESH = mergeParts([...MOTOR_PARTS, { geometry: propEnvelope, position: PROPELLER_POSITION }]);
propEnvelope.dispose();

export function motorSteeringAngle(state) {
  return (state.steering || 0) * 0.3;
}
export function advancePropeller(phase, speed, delta, paused = false) {
  if (paused || Math.abs(speed) < 0.025) return phase;
  return (phase + Math.sign(speed) * Math.min(Math.max(delta, 0), 0.09) * (12 + Math.abs(speed) * 8)) % (Math.PI * 2);
}
