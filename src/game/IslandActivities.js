import { startCharacterAction } from './CharacterAction.js';
import { DOCK, dockWorldPoint } from './WalkingSurface.js';

export const DOCK_BELL = { ...dockWorldPoint(1.25, 2.5), y: DOCK.deckHeight, rotation: DOCK.rotation + Math.PI / 2 };
export const ACTIVITIES = {
  bell: { ...dockWorldPoint(.6, 2.5), label: 'Ring the bell', duration: 5 },
  stones: { x: 2, z: -3.5, label: 'Skip a stone', duration: 3.6 },
};
export function nearbyActivity(s) {
  if (s.mode !== 'walking' || s.jumping || s.activeDiscovery) return null;
  return Object.keys(ACTIVITIES).find(id => Math.hypot(s.position.x-ACTIVITIES[id].x,s.position.z-ACTIVITIES[id].z)<1.7) ?? null;
}
export function advanceActivity(s, dt) {
  if (s.activity) {
    s.activity.time += dt;
    if (s.activity.time >= ACTIVITIES[s.activity.id].duration) s.activity = null;
  }
}
export function stepActivity(s, pressed) {
  s.nearActivity = nearbyActivity(s);
  if (!pressed || !s.nearActivity || s.activeDiscovery || s.nearDiscovery) return false;
  if (!s.activity) {
    s.activity = { id: s.nearActivity, time: -.3 };
    const p=ACTIVITIES[s.nearActivity];
    startCharacterAction(s,s.nearActivity,s.nearActivity==='bell'?DOCK_BELL:{x:p.x,z:p.z+3});
    if(s.nearActivity==='stones')s.heading=Math.PI;
  }
  return true;
}
export function skippingStonePose(time) {
  if (time < .45) return { z: -3.5 + time/.45*2.5, y: .15 + Math.sin(time/.45*Math.PI)*.8, hop: -1, phase:time/.45, visible:true };
  time -= .45;
  const duration=.65, hop=Math.min(3,Math.floor(time/duration)), phase=Math.min(1,(time-hop*duration)/duration);
  return { z: -1 + hop*1.6 + phase*1.6, y: .06 + Math.sin(phase*Math.PI)*(.7-hop*.15), hop, phase, visible:time<duration*4 };
}
