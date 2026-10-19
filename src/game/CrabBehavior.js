import { stepCrabStory } from './CrabStory.js';
import { crabDestination, crabPath, crabEscapeTarget, crabWalkable } from './CrabNavigation.js';
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function createCrabBehavior() {
  return { x: -0.8, z: 6, time: 0, gait: 0, heading: 0, speed: 0,
    path: [], pathIndex: 0, routeTime: 0, routeMode: null, mode: 'wander', timer: 2, alarm: 0, hidden: 0, uncover: 0, uncovered: false, targetX: 1, targetZ: 6.5, seed: 8137 };
}

// Coordinates are island-local. Routes connect the beach and dock without crossing water.
export function stepCrab(s, player, delta, paused = false, discovery = null) {
  if (paused) return;
  const dt = clamp(delta, 0, 0.05);
  s.time += dt;
  s.timer -= dt;
  s.routeTime -= dt;
  const dx = player ? s.x - player.x : 0;
  const dz = player ? s.z - player.z : 0;
  const distance = player ? Math.hypot(dx, dz) : Infinity;
  if (discovery?.enabled) { stepCrabStory(s, player, dt, discovery); return; }
  if (!discovery?.enabled && discovery?.running && distance < 2.6 && s.hidden <= 0) s.hidden = 2.5;
  if (s.hidden > 0) {
    s.hidden = Math.max(0, s.hidden - dt);
    s.mode = 'hide'; s.speed = 0; s.alarm = 0;
    return;
  }
  if (distance < 2.6 || (s.mode === 'flee' && distance < 4)) s.alarm = 1.2;
  else s.alarm = Math.max(0, s.alarm - dt);

  let vx = 0, vz = 0, speed = 0;
  if (s.alarm > 0) {
    s.mode = 'flee';
    s.timer = 0;
    const away = distance > 0.001 && player ? Math.atan2(dz, dx) : -s.heading;
    vx = Math.cos(away) * 3.5;
    vz = Math.sin(away) * 3.5;
    speed = 2.1;
  } else {
    if (s.timer <= 0 || (s.mode === 'wander' && Math.hypot(s.targetX - s.x, s.targetZ - s.z) < 0.15)) {
      s.mode = random(s) < 0.58 ? 'wander' : random(s) < 0.5 ? 'dig' : 'wave';
      s.timer = s.mode === 'wander' ? 2.5 + random(s) * 3 : 1.2 + random(s) * 2;
      const destination = crabDestination(() => random(s));
      s.targetX = destination.x; s.targetZ = destination.z;
      s.routeTime = 0;
      if (s.mode === 'wander') s.timer = 60;
    }
    if (s.mode === 'wander') {
      vx = s.targetX - s.x;
      vz = s.targetZ - s.z;
      speed = 0.48;
    }
  }
  if (speed && Math.hypot(vx,vz)>0.001) {
    if(s.routeTime<=0 || s.routeMode!==s.mode) {
      const destination=s.mode==='flee'?crabEscapeTarget(s.x,s.z,player?.x??s.x-vx,player?.z??s.z-vz):{x:s.x+vx,z:s.z+vz};
      s.path=crabPath(s.x,s.z,destination.x,destination.z);s.pathIndex=0;
      s.routeTime=s.mode==='flee'?1:20;s.routeMode=s.mode;
    }
    while(s.pathIndex<s.path.length && Math.hypot(s.path[s.pathIndex].x-s.x,s.path[s.pathIndex].z-s.z)<0.005)s.pathIndex++;
    const next=s.path[s.pathIndex];
    if(next){vx=next.x-s.x;vz=next.z-s.z;}
    else {vx=0;vz=0;s.routeTime=0;s.timer=0;}
  }
  const length = Math.hypot(vx, vz);
  s.speed = length > 0.001 ? speed : 0;
  if (s.speed) {
    const travel=Math.min(length,speed*dt);
    const nx=s.x+vx/length*travel,nz=s.z+vz/length*travel;
    if(!crabWalkable(nx,nz)){s.routeTime=0;s.speed=0;return;}
    s.x=nx;s.z=nz;
    const target = Math.atan2(-vz, vx);
    const turn = Math.atan2(Math.sin(target - s.heading), Math.cos(target - s.heading));
    s.heading += turn * Math.min(1, dt * 12);
    s.gait += dt * (s.mode === 'flee' ? 36 : 17);
  }
}
