import { BufferGeometry, Float32BufferAttribute, Color, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sharkCenterline } from "./WildlifeSimulation.js";

const pigment = (hex) => new Color(hex);
function tint(geometry, color) {
  const p = geometry.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) colors.push(color.r, color.g, color.b);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  if (geometry.attributes.uv) geometry.deleteAttribute("uv");
  return geometry;
}
function polygon(points, color) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  const indices = [];
  for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return tint(geometry, pigment(color));
}
function eye(x, y, z, radius) {
  const geometry = new SphereGeometry(radius, 7, 5);
  geometry.translate(x, y, z);
  return tint(geometry, pigment("#112f35"));
}
function merge(parts) {
  const result = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return result;
}

function body(species) {
  const butterfly = species === "butterfly", shark = species === "shark", manta = species === "manta";
  const length = shark ? 1.45 : manta ? 0.84 : butterfly ? 0.68 : 0.96;
  const height = shark ? 0.24 : manta ? 0.135 : butterfly ? 0.43 : species === "parrot" ? 0.28 : 0.17;
  const width = shark ? 0.25 : manta ? 0.4 : butterfly ? 0.13 : species === "parrot" ? 0.2 : 0.14;
  const positions = [], colors = [], indices = [], segments = 10, rings = 12;
  const palette = species === "silver" ? ["#7daca9", "#d7e9cb", "#c7d8cd"]
    : species === "butterfly" ? ["#bb920e", "#efce35", "#eac55a"]
      : species === "parrot" ? ["#287978", "#65c3a3", "#b9dcb6"]
        : shark ? ["#477377", "#769696", "#cedbd1"] : ["#426866", "#557e76", "#d0ddca"];
  const shades = palette.map(pigment), black = pigment("#193d42"), accent = pigment("#d68c69");
  for (let ring = 0; ring <= rings; ring++) {
    const u = ring / rings, x = (u * 2 - 1) * length;
    // A narrow tail wrist, full shoulders and a pointed, slightly flattened nose.
    const envelope = manta ? Math.sin(Math.PI * u) ** 0.64 * (0.77 + u * 0.3) + u ** 8 * 0.47
      : Math.sin(Math.PI * u) ** 0.74 * (0.75 + u * 0.35);
    for (let j = 0; j <= segments; j++) {
      const angle = j / segments * Math.PI * 2, y = Math.cos(angle) * height * envelope, z = Math.sin(angle) * width * envelope;
      positions.push(x, y, z);
      const color = y > height * 0.32 ? shades[0].clone() : y < -height * 0.18 ? shades[2].clone() : shades[1].clone();
      if (butterfly && (Math.abs(u - 0.3) < 0.075 || Math.abs(u - 0.76) < 0.055)) color.lerp(black, 0.9);
      if (species === "parrot" && (u > 0.86 || (u > 0.35 && u < 0.42))) color.lerp(accent, u > 0.86 ? 0.75 : 0.42);
      const facet = 0.98 + Math.sin(angle * 3 + u * 2) * 0.04;
      colors.push(color.r * facet, color.g * facet, color.b * facet);
      if (ring < rings && j < segments) {
        const a = ring * (segments + 1) + j, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  if (manta) {
    const centre = positions.length / 3, lastRing = rings * (segments + 1);
    positions.push(length, 0, 0); colors.push(shades[1].r, shades[1].g, shades[1].b);
    for (let j = 0; j < segments; j++) indices.push(centre, lastRing + j, lastRing + j + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function fish(species) {
  const butterfly = species === "butterfly", parrot = species === "parrot";
  const h = butterfly ? 0.43 : parrot ? 0.28 : 0.17;
  const w = butterfly ? 0.13 : parrot ? 0.2 : 0.14;
  const length = butterfly ? 0.68 : 0.96;
  const color = butterfly ? "#dcb127" : parrot ? "#468d99" : "#9abebb";
  const parts = [body(species),
    polygon([[-0.54, h * 0.64, 0], [-0.34, h + (butterfly ? 0.16 : 0.14), 0], [0.35, h * 0.85, 0], [0.5, h * 0.65, 0]], color),
    polygon([[-0.45, -h * 0.55, 0], [-0.34, -h - 0.11, 0], [0.15, -h * 0.87, 0]], color),
    polygon([[0.25, -0.01, w * 0.75], [-0.16, -0.07, w + 0.18], [-0.18, -0.11, w * 0.7]], color),
    polygon([[0.25, -0.01, -w * 0.75], [-0.16, -0.07, -w - 0.18], [-0.18, -0.11, -w * 0.7]], color),
    eye(length * 0.65, h * 0.2, w * 0.67, 0.043), eye(length * 0.65, h * 0.2, -w * 0.67, 0.043)];
  const tail = polygon([[0.04, 0.02, 0], [-0.38, butterfly ? 0.25 : 0.28, 0], [-0.27, 0.02, 0], [-0.38, butterfly ? -0.25 : -0.28, 0], [0.04, -0.02, 0]], color);
  return { body: merge(parts), tail, tailX: -length * 0.8 };
}

function mantaWing() {
  const positions = [], colors = [], indices = [], coordinates = [], spans = 18, chords = 16;
  const spanRows = spans * 2, surfaceCount = (spanRows + 1) * (chords + 1);
  // One continuous foil joins the flattened head and disc to both wings. There
  // is no ellipsoid, seam or separate inflated shoulder underneath this surface.
  for (let side = 0; side < 2; side++) {
    const offset = positions.length / 3;
    for (let v = 0; v <= spanRows; v++) for (let u = 0; u <= chords; u++) {
      const signedSpan = v / spans - 1, span = Math.abs(signedSpan), chord = u / chords;
      const front = 0.84 - span * 0.1 - Math.pow(Math.max(0, span - 0.15) / 0.85, 1.7) * 1.01;
      const rear = -0.82 + span * 0.52 - Math.sin(span * Math.PI) * 0.11;
      const section = Math.sqrt(Math.max(0, Math.sin(chord * Math.PI)));
      const head = Math.exp(-((span / 0.23) ** 2)) * Math.exp(-(((chord - 0.23) / 0.28) ** 2));
      const thickness = 0.003 + section * Math.pow(1 - span, 1.8) * 0.048;
      const camber = Math.sin(chord * Math.PI) * (1 - span) * 0.007 + head * 0.012;
      positions.push(front + (rear - front) * chord, camber + (side ? -thickness : thickness), signedSpan * 1.8);
      coordinates.push(span, chord);
      const color = pigment(side ? "#c4d3c0" : "#244d53");
      if (!side) {
        const shoulder = Math.exp(-(((span - 0.16) / 0.15) ** 2)) * Math.max(0, 1 - chord / 0.48);
        color.lerp(pigment("#a4bbb0"), shoulder * 0.4);
        color.multiplyScalar(0.93 + Math.sin(chord * Math.PI) * 0.1);
      }
      colors.push(color.r, color.g, color.b);
      if (u < chords && v < spanRows) {
        const a = offset + v * (chords + 1) + u, b = a + chords + 1;
        const faces = [a, b, a + 1, a + 1, b, b + 1];
        if (!side) faces.reverse();
        indices.push(...faces);
      }
    }
  }
  const connect = (a, b) => indices.push(a, a + surfaceCount, b, b, a + surfaceCount, b + surfaceCount);
  for (let v = 0; v < spanRows; v++) {
    connect((v + 1) * (chords + 1), v * (chords + 1));
    connect(v * (chords + 1) + chords, (v + 1) * (chords + 1) + chords);
  }
  for (let u = 0; u < chords; u++) {
    connect(u, u + 1);
    connect(spanRows * (chords + 1) + u + 1, spanRows * (chords + 1) + u);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.rest = Float32Array.from(positions);
  geometry.userData.wingCoordinates = Float32Array.from(coordinates);
  return geometry;
}

function cephalicFin(side) {
  const positions = [], colors = [], indices = [], rows = 12, columns = 8;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    const t = i / rows, u = j / columns;
    // A broad sheet grows out of the front corner, then rolls inward at its tip.
    // The folded edge is a membrane, with a hollow visible beneath the curl.
    const breadth = 0.27 * (1 - t * t * 0.85), curl = Math.max(0, (t - 0.15) / 0.85);
    const roll = 0.28 + curl * 3.8, angle = (u - 0.5) * roll;
    const lateral = Math.sin(angle) * breadth / roll;
    positions.push(0.64 + t * 0.34 - Math.sin(t * Math.PI) * 0.025,
      0.023 + Math.sin(t * Math.PI) * 0.025 + (1 - Math.cos(angle)) * breadth / roll - curl * 0.018,
      side * (0.3 - curl * 0.085 + lateral));
    const color = pigment("#476b6b").lerp(pigment("#9aaea0"), Math.sin(u * Math.PI) * 0.33);
    colors.push(color.r, color.g, color.b);
    if (i < rows && j < columns) {
      const a = i * (columns + 1) + j, b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function mantaMouth() {
  const positions = [], colors = [], indices = [];
  for (let i = 0; i <= 12; i++) {
    const z = (i / 12 - 0.5) * 0.48, arch = Math.sin(i / 12 * Math.PI);
    const x = 0.853 - Math.abs(z) * 0.055;
    // A raised upper lip borders an inset dark opening facing forward and up.
    positions.push(x - 0.022, 0.019 + arch * 0.008, z,
      x + 0.01, 0.008, z, x + 0.031, -0.028 - arch * 0.008, z);
    for (const hex of ["#91a598", "#102c32", "#476c68"]) { const c = pigment(hex); colors.push(c.r, c.g, c.b); }
    if (i < 12) { const a = i * 3; indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function manta() {
  const curve = new CatmullRomCurve3([new Vector3(-0.58, 0, 0), new Vector3(-1.25, -0.025, 0.025), new Vector3(-2.05, -0.06, 0.06)]);
  const whip = new TubeGeometry(curve, 16, 0.026, 6, false);
  const p = whip.attributes.position;
  for (let ring = 0; ring <= 16; ring++) {
    const t = ring / 16, centre = curve.getPointAt(t), factor = (0.003 + 0.023 * (1 - t) ** 0.7) / 0.026;
    for (let j = 0; j <= 6; j++) {
      const i = ring * 7 + j;
      p.setXYZ(i, centre.x + (p.getX(i) - centre.x) * factor, centre.y + (p.getY(i) - centre.y) * factor, centre.z + (p.getZ(i) - centre.z) * factor);
    }
  }
  whip.computeVertexNormals();
  const parts = [tint(whip, pigment("#698782")), mantaMouth(), cephalicFin(-1), cephalicFin(1),
    eye(0.63, 0.044, 0.33, 0.031), eye(0.63, 0.044, -0.33, 0.031),
    polygon([[-0.49, 0.054, 0], [-0.66, 0.14, 0], [-0.78, 0.035, 0]], "#365d60")];
  const geometry = merge(parts);
  geometry.userData.rest = Float32Array.from(geometry.attributes.position.array);
  return { body: geometry, wings: mantaWing() };
}

function sharkPectoral(side) {
  const positions = [], indices = [], spans = 10, chords = 8;
  for (let i = 0; i <= spans; i++) for (let j = 0; j <= chords; j++) {
    const span = i / spans, chord = j / chords, front = 0.37 - span * 0.86, rear = -0.5 - span * 0.015;
    positions.push(front + (rear - front) * chord,
      -0.035 - span * 0.13 + Math.sin(chord * Math.PI) * 0.042 * (1 - span) - chord * span * 0.035,
      side * (0.19 + span * 0.48));
    if (i < spans && j < chords) {
      const a = i * (chords + 1) + j, b = a + chords + 1;
      const faces = [a, b, a + 1, a + 1, b, b + 1];
      if (side > 0) faces.reverse();
      indices.push(...faces);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return tint(geometry, pigment("#789d98"));
}

function shark() {
  const parts = [body("shark"),
    polygon([[0.2, 0.17, 0], [-0.05, 0.61, 0], [-0.41, 0.15, 0]], "#527d7d"),
    polygon([[-0.82, 0.12, 0], [-0.99, 0.29, 0], [-1.12, 0.06, 0]], "#648c8b"),
    sharkPectoral(1), sharkPectoral(-1),
    polygon([[-1.15, 0.01, 0], [-1.55, 0.63, 0], [-1.67, 0.6, 0], [-1.52, 0.09, 0], [-1.65, -0.41, 0], [-1.53, -0.37, 0], [-1.19, -0.025, 0]], "#598584"),
    eye(0.99, 0.045, 0.16, 0.043), eye(0.99, 0.045, -0.16, 0.043)];
  // Three narrow gill marks on each flank survive a modest camera scale.
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) parts.push(polygon([[0.52 - i * 0.1, 0.12, side * 0.229], [0.50 - i * 0.1, -0.11, side * 0.239], [0.47 - i * 0.1, -0.1, side * 0.24]], "#365e63"));
  const caudalStart = parts.slice(0, 5).reduce((n, g) => n + g.attributes.position.count, 0), caudalCount = parts[5].attributes.position.count;
  const geometry = merge(parts);
  geometry.userData.rest = Float32Array.from(geometry.attributes.position.array);
  geometry.userData.caudalRange = [caudalStart, caudalStart + caudalCount];
  return { body: geometry };
}

export function createDockFishGeometry() { return fish("butterfly"); }

export function createWildlifeGeometry() {
  return { silver: fish("silver"), butterfly: fish("butterfly"), parrot: fish("parrot"), manta: manta(), shark: shark() };
}

export function deformMantaWings(geometry, stroke, motion = null) {
  const positions = geometry.attributes.position, rest = geometry.userData.rest, coordinates = geometry.userData.wingCoordinates;
  for (let i = 0; i < positions.count; i++) {
    const span = coordinates[i * 2], chord = coordinates[i * 2 + 1];
    const side = Math.sign(rest[i * 3 + 2]), active = Math.max(0, (span - 0.22) / 0.78);
    // The thorax stays rigid. The inner leading edge drives the stroke, then
    // the outer span follows; the trailing membrane folds during recovery.
    const phase = stroke - active * 1.8, drive = Math.sin(phase) - Math.sin(phase * 2) * 0.18;
    const turn = 1 + side * Math.max(-0.38, Math.min(0.38, motion?.turnVelocity || 0)) * 0.1;
    const heave = drive * 0.29 * active ** 1.25 * turn;
    const release = Math.sin(phase - 1.0) * 0.082 * active * chord * chord;
    const front = 0.84 - span * 0.1 - Math.pow(Math.max(0, span - 0.15) / 0.85, 1.7) * 1.01;
    const rear = -0.82 + span * 0.52 - Math.sin(span * Math.PI) * 0.11;
    const pivot = front + (rear - front) * 0.22;
    const pitch = Math.cos(phase) * 0.18 * active;
    const dx = rest[i * 3] - pivot, y = rest[i * 3 + 1];
    positions.setX(i, pivot + dx * Math.cos(pitch) - y * Math.sin(pitch));
    positions.setY(i, dx * Math.sin(pitch) + y * Math.cos(pitch) + heave + release);
    // Span shortens as the wing cups, while the thin tip releases aft.
    const cup = Math.min(0.16, (heave + release) ** 2 / Math.max(0.2, span * 1.8));
    positions.setZ(i, rest[i * 3 + 2] - side * cup + side * Math.cos(phase - 0.8) * 0.025 * active * chord);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals();
}

export function deformMantaBody(geometry, stroke, motion = null) {
  const p = geometry.attributes.position, rest = geometry.userData.rest;
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], tail = Math.max(0, Math.min(1, (-0.58 - x) / 1.47));
    const trail = sharkCenterline(motion, x), weight = tail * tail;
    p.setX(i, x + (trail.x - x) * weight);
    p.setY(i, rest[i * 3 + 1] + Math.sin(stroke * 0.65 - tail * 3.4) * 0.075 * weight);
    p.setZ(i, rest[i * 3 + 2] + trail.z * weight + Math.sin(stroke * 0.65 - tail * 3.4) * 0.155 * weight);
  }
  p.needsUpdate = true; geometry.computeVertexNormals();
}

export function sharkSwimmingCenterline(distance, stroke, motion = null) {
  const sample = (x) => {
    const trail = sharkCenterline(motion, x);
    // The current heading carries a firm head and thorax. The rear trunk
    // joins the travelled path smoothly, rather than bending the entire shark.
    const follow = Math.max(0, Math.min(1, (-x - 0.15) / 0.7));
    const weight = follow * follow * (3 - 2 * follow);
    const centre = { x: x + (trail.x - x) * weight, z: trail.z * weight, tangent: trail.tangent * weight };
    const flex = Math.max(0, Math.min(1, (0.8 - x) / 2.53));
    const wave = Math.sin(stroke - flex * 3) * (0.018 * flex + 0.43 * flex ** 2);
    return { x: centre.x - wave * Math.sin(centre.tangent), z: centre.z + wave * Math.cos(centre.tangent) };
  };
  const centre = sample(distance), before = sample(distance - 0.008), after = sample(distance + 0.008);
  return { ...centre, tangent: Math.atan2(after.z - before.z, after.x - before.x) };
}

export function deformShark(geometry, stroke, motion = null) {
  const positions = geometry.attributes.position, rest = geometry.userData.rest, [caudalStart, caudalEnd] = geometry.userData.caudalRange;
  const wristSpine = sharkSwimmingCenterline(-1.15, stroke, motion);
  const caudalYaw = wristSpine.tangent + Math.sin(stroke - 2.65) * 0.12;
  const c = Math.cos(caudalYaw), s = Math.sin(caudalYaw), sections = new Map();
  for (let i = 0; i < positions.count; i++) {
    const x = rest[i * 3];
    if (i >= caudalStart && i < caudalEnd) {
      const dx = x + 1.15, z = rest[i * 3 + 2];
      positions.setX(i, wristSpine.x + dx * c - z * s);
      positions.setZ(i, wristSpine.z + dx * s + z * c);
    } else {
      if (!sections.has(x)) sections.set(x, sharkSwimmingCenterline(x, stroke, motion));
      const centre = sections.get(x), z = rest[i * 3 + 2];
      positions.setX(i, centre.x - z * Math.sin(centre.tangent));
      positions.setZ(i, centre.z + z * Math.cos(centre.tangent));
    }
  }
  positions.needsUpdate = true; geometry.computeVertexNormals();
}
