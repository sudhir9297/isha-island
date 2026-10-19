import { SHELL } from './Discoveries.js';

// Island-local coordinates. Keep this small route on the open sand.
export const CRAB_STORY_ROUTE = Object.freeze([
  { x: -.8, z: 6 }, { x: -1.8, z: 5.4 }, { x: -3.2, z: 5.7 },
  { x: SHELL.x, z: SHELL.z + 12 },
].map(Object.freeze));

function face(s, player, dt) {
  if (!player) return;
  const angle = Math.atan2(player.x - s.x, player.z - s.z);
  s.heading += Math.atan2(Math.sin(angle - s.heading), Math.cos(angle - s.heading)) * (1 - Math.exp(-dt * 6));
}
function move(s, target, dt) {
  const dx = target.x - s.x, dz = target.z - s.z, distance = Math.hypot(dx, dz);
  const speed = Math.min(.48, distance * 3);
  const travel = Math.min(distance, speed * dt);
  s.mode = 'guide'; s.speed = dt > 0 ? travel / dt : 0;
  if (distance > .001) {
    s.x += dx / distance * travel; s.z += dz / distance * travel;
    const angle = Math.atan2(-dz, dx);
    s.heading += Math.atan2(Math.sin(angle - s.heading), Math.cos(angle - s.heading)) * (1 - Math.exp(-dt * 10));
    s.gait += travel * 30;
  }
  return distance < .035;
}
export function stepCrabStory(s, player, dt, discovery) {
  s.story ??= { phase: 'greet', index: 1, time: 0, waiting: false };
  const story = s.story;
  s.hidden = 0; s.alarm = 0;
  if (discovery.finished && !['reveal', 'farewell', 'return', 'done'].includes(story.phase)) story.phase = 'reveal';
  if (discovery.collected && story.phase === 'reveal') { story.phase = 'farewell'; story.time = 0; }
  s.speed = 0;
  const distance = player ? Math.hypot(player.x - s.x, player.z - s.z) : Infinity;
  if (story.phase === 'return') {
    if (move(s, CRAB_STORY_ROUTE[story.index], dt)) {
      if (story.index === 0) { story.phase = 'done'; s.storyDone = true; s.speed = 0; s.mode = 'wave'; }
      else story.index--;
    }
    return;
  }
  if (story.phase === 'farewell') {
    s.mode = 'wave'; face(s, player, dt); story.time += dt;
    if (story.time >= 1.8) { story.phase = 'return'; story.index = 2; }
    return;
  }
  if (story.phase === 'reveal' || story.phase === 'done') { s.mode = 'wave'; face(s, player, dt); return; }
  // Hysteresis prevents rapid start/stop flicker around the follow boundary.
  if (distance > 4.8) story.waiting = true;
  else if (distance < 3.2) story.waiting = false;
  if (!discovery.invited || story.waiting) { s.mode = 'wave'; face(s, player, dt); return; }
  if (story.phase === 'greet' || story.phase === 'stop') {
    s.mode = 'wave'; face(s, player, dt);
    if (distance < 3.2) story.time += dt;
    if (story.time >= (story.phase === 'greet' ? 1 : 1.4)) { story.phase = 'walk'; story.time = 0; }
  } else if (story.phase === 'walk') {
    if (move(s, CRAB_STORY_ROUTE[story.index], dt)) {
      s.speed = 0; story.time = 0;
      if (story.index === CRAB_STORY_ROUTE.length - 1) story.phase = 'dig';
      else { story.index++; story.phase = 'stop'; }
    }
  } else if (story.phase === 'dig') {
    s.mode = 'dig'; story.time += dt;
    if (story.time >= 2.2) { s.uncovered = true; story.phase = 'reveal'; }
  }
}
