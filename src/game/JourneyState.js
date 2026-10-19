import { advanceCharacterAction } from './CharacterAction.js';
import { stepNeemSeat } from './NeemSeat.js';
import { stepActivity, advanceActivity } from './IslandActivities.js';
import { slideWalkingMove } from './WalkingObstacles.js';
import { stepChapterOne } from './ChapterOne.js';
import { hitsNeemProps } from './NeemTerrain.js';
import { interactDiscovery } from './Discoveries.js';
import { nearRestSpot, hitsOverlookSeat } from './StoryMoments.js';
import { WORLD_MARKERS } from './WorldMarkers.js';
import { BOAT_SCALE } from './WorldConfig.js';
import { boatProfile } from './BoatProfiles.js';
import { Vector3 } from 'three';
import { worldCoastalRadiusAt } from './Seabed.js';
import { islandCenterAt, islandGroundAt } from './IslandGround.js';
import { DOCK, dockWorldPoint, walkingSurfaceHeight } from './WalkingSurface.js';
export const JUMP_DURATION = 1.5;
export function createJourney(resetId = 0) {
  return { action: null, nearBench: false, benchSeated: false, seatTime: 0, activity: null, nearActivity: null, seenHints: [], velocityX: 0, velocityZ: 0, noteRead: false, crabInvited: false, crabPosition: null, crabHint: null, shellRevealed: false, shellFound: false, nearDiscovery: null, activeDiscovery: null, dismissDiscovery: false, running: false, jumping: false, jumpTime: 0, jumpHeld: false, rehearsal: false, rehearsalManual: false, mode: 'aboard', position: new Vector3(), heading: 0, landing: new Vector3(), released: false,
    releaseTime: 0, completed: false, restTime: 0, nearRest: false, releaseOrigin: null, resetId, canLand: false, availableLanding: null, interactionHeld: false, distance: 0 };
}
// Keep the walker's body and carried bags beyond the oriented gunwale/motor.
export function clearOfBoat(x, z, boat) {
  const heading = boat.heading ?? 0, sin = Math.sin(heading), cos = Math.cos(heading);
  const dx = x - boat.position.x, dz = z - boat.position.z;
  const localX = dx * cos - dz * sin, localZ = dx * sin + dz * cos;
  const [sx, , sz] = boatProfile(boat.boatId).modelScale;
  return Math.abs(localX) > 1.04 * BOAT_SCALE * sx + .6
    || Math.abs(localZ) > 2.25 * BOAT_SCALE * sz + .6;
}
export function landingPoint(boat) {
  if (Math.abs(boat.speed) > 1.8) return null;
  const p = boat.position;
  // Let a slow boat land directly on the pier, including from either side.
  // Keep the landing inside the rails and outside the boat's full footprint.
  if (Math.hypot(p.x - DOCK.x, p.z - DOCK.z) < 12) {
    let nearest = null, nearestDistance = 4;
    for (let along = 0; along <= DOCK.end - .3; along += .2) {
      for (const across of [-.65, 0, .65]) {
        const point = dockWorldPoint(across, along);
        const distance = Math.hypot(point.x - p.x, point.z - p.z);
        if (distance < nearestDistance && clearOfBoat(point.x, point.z, boat)) {
          nearest = new Vector3(point.x, DOCK.deckHeight, point.z);
          nearestDistance = distance;
        }
      }
    }
    if (nearest) return nearest;
  }
  // Search along the inward beach normal for the closest dry footing.
  const center = islandCenterAt(p.x, p.z);
  const dx = center.x - p.x, dz = center.z - p.z, length = Math.hypot(dx, dz);
  if (length < .001) return null;
  for (let d = 0; d <= 4; d += .2) {
    const x = p.x + dx / length * d, z = p.z + dz / length * d;
    if (worldCoastalRadiusAt(x, z) < .94 && clearOfBoat(x, z, boat)) return new Vector3(x, islandGroundAt(x, z), z);
  }
  return null;
}
export function stepJourney(s, boat, controls, delta, paused = false, blocksMovement) {
  if (s.resetId !== boat.resetId) Object.assign(s, createJourney(boat.resetId));
  if (paused) { s.interactionHeld = Boolean(controls.interact); s.jumpHeld = Boolean(controls.brake); controls.jumpRequested = false; return; }
  const dt = Math.min(.05, Math.max(0, delta));
  advanceActivity(s, dt);
  advanceCharacterAction(s, dt);
  s.running = false;
  const jumpPressed = controls.jumpRequested || (controls.brake && !s.jumpHeld);
  controls.jumpRequested = false;
  s.jumpHeld = Boolean(controls.brake);
  if (s.jumping) {
    s.jumpTime = Math.min(JUMP_DURATION, s.jumpTime + dt);
    if (s.jumpTime >= JUMP_DURATION) s.jumping = false;
  }
  if (s.released) s.releaseTime += dt;
  const pressed = s.requestInteract || (controls.interact && !s.interactionHeld);
  s.requestInteract = false;
  s.interactionHeld = Boolean(controls.interact);
  if(s.action && s.action.kind!=='pickup')return;
  const landing = s.mode === 'aboard' ? landingPoint(boat) : null;
  s.canLand = Boolean(landing);
  s.availableLanding = landing;
  if (s.mode === 'aboard') {
    if (pressed && landing) {
      s.mode = 'walking'; s.position.copy(landing); s.landing.copy(landing);
      s.heading = Math.atan2(landing.x, landing.z + 12);
      boat.speed = 0; boat.velocity = undefined; boat.destination = null;
      s.gateEntered = false;
    }
    return;
  }
  stepChapterOne(s, boat);
  if (interactDiscovery(s, pressed)) return;
  if (stepNeemSeat(s, pressed, controls, dt)) return;
  if (stepActivity(s, pressed)) return;
  s.nearRest = s.released && nearRestSpot(s.position);
  if (s.mode === 'resting') {
    s.restTime += dt;
    if (pressed || controls.forward || controls.backward || controls.left || controls.right) s.mode = 'walking';
    return;
  }
  if (!s.jumping && pressed && s.nearRest && s.releaseTime >= 2) {
    s.mode = 'resting'; s.completed = true; s.restTime = 0; s.heading = 0; return;
  }
  if (!s.jumping && pressed && s.position.distanceTo(s.landing) < 1.7) {
    s.mode = 'aboard'; return;
  }
  if (jumpPressed && !s.jumping && !(s.released && s.releaseTime < .65)) {
    s.jumping = true; s.jumpTime = 0;
  }
  let dx = Number(Boolean(controls.right)) - Number(Boolean(controls.left));
  let dz = Number(Boolean(controls.backward)) - Number(Boolean(controls.forward));
  const length = Math.hypot(dx, dz);
  const locked = s.released && s.releaseTime < .65;
  const ease = s.released ? Math.min(1, Math.max(0, (s.releaseTime - .65) / .9)) : 0;
  const speed = (1.65 + ease * .85) * (controls.run ? 1.75 : 1);
  const wantedX = length && !locked ? (dx*.894-dz*.447)/length*speed : 0;
  const wantedZ = length && !locked ? (dx*.447+dz*.894)/length*speed : 0;
  const airborne = s.jumping && s.jumpTime >= .2 && s.jumpTime < 1;
  const steering = airborne && !locked ? 1-Math.exp(-dt*3) : 1;
  s.velocityX += (wantedX-s.velocityX)*steering;
  s.velocityZ += (wantedZ-s.velocityZ)*steering;
  if (Math.hypot(s.velocityX,s.velocityZ) > .001 && !locked) {
    const canEnter=(x,z)=>{
      const floor=walkingSurfaceHeight(x,z);
      const wall=Math.abs(z+12)<.65 && Math.abs(x)>1.15 && Math.abs(x)<9.2;
      return floor!==null && !wall && !hitsNeemProps(x,z) && !hitsOverlookSeat(x,z)
        && clearOfBoat(x,z,boat) && !blocksMovement?.(x,z,floor);
    };
    const next=slideWalkingMove(s.position.x,s.position.z,s.velocityX*dt,s.velocityZ*dt,canEnter);
    const nx=next.x,nz=next.z,floor=walkingSurfaceHeight(nx,nz);
    const traveled=Math.hypot(nx-s.position.x,nz-s.position.z);
    if (traveled > 1e-7) {
      s.running = Boolean(controls.run);
      s.distance += traveled;
      // Only traversing the central doorway from the arrival side releases bags.
      if (Math.abs(nx - WORLD_MARKERS.gateEntry[0]) < 1.15 && s.position.z > WORLD_MARKERS.gateEntry[2] && nz <= WORLD_MARKERS.gateEntry[2]) s.gateEntered = true;
      if (Math.abs(nx - WORLD_MARKERS.gateEntry[0]) >= 1.15 || nz > WORLD_MARKERS.gateEntry[2] + .05) s.gateEntered = false;
      if (!s.released && s.gateEntered && nz < WORLD_MARKERS.gateExit[2]) { s.released = true; s.releaseTime = 0; s.releaseOrigin = {x:nx,y:islandGroundAt(nx,nz),z:nz}; stepChapterOne(s, boat); }
      s.position.set(nx, floor, nz);
      s.heading = Math.atan2(-s.velocityX, -s.velocityZ);
    } else { s.velocityX=0; s.velocityZ=0; }
  }
}
