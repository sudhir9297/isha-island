import { startCharacterAction } from './CharacterAction.js';
import { KEEPSAKES, collectItem } from './Keepsakes.js';
import { DOCK, dockWorldPoint } from './WalkingSurface.js';
export const DOCK_NOTE = dockWorldPoint(0, DOCK.end - 0.35);
export const SHELL = { x: -4.4, z: -5.7 };
export const DISCOVERIES = {
  note: { title: 'A welcome on the shore', text: '“You don’t have to carry everything with you.”', detail: 'A red crab waits beside the landing. Go and say hello.' },
  crab: { title: 'An unexpected guide', text: 'One raised claw. A few sideways steps. An invitation.', detail: 'Stay close and follow it along the sand.' },
  shell: { title: 'A small keepsake', text: 'Beneath the sand, a shell worn smooth by the sea.', detail: 'Added to your satchel. When you’re ready, continue through Malai Vasal.' },
};
for (const item of KEEPSAKES.filter(item => item.id !== 'shell')) DISCOVERIES[item.id] = { title: item.name, text: item.memory, detail: 'Added to your satchel. Take a look whenever you like.', island: item.island };
export function nearbyDiscovery(s) {
  if (s.mode !== 'walking' || s.jumping) return null;
  const near = p => Math.hypot(s.position.x-p.x,s.position.z-p.z)<1.1;
  for (const item of KEEPSAKES) {
    if (item.x !== undefined && !s.keepsakes?.includes(item.id) && near(item)) return item.id;
  }
  if (!s.noteRead && near(DOCK_NOTE)) return 'note';
  if (s.shellRevealed && !s.shellFound && !s.keepsakes?.includes('shell') && near(SHELL)) return 'shell';
  if (s.noteRead && !s.shellRevealed && !s.crabInvited && s.crabPosition && Math.hypot(s.position.x-s.crabPosition.x,s.position.z-s.crabPosition.z)<2.1) return 'crab';
  return null;
}
export function interactDiscovery(s, pressed) {
  s.nearDiscovery = nearbyDiscovery(s);
  if (s.activeDiscovery) {
    if(s.action?.kind==='pickup')return true;
    if (pressed || s.dismissDiscovery) { s.activeDiscovery = null; s.dismissDiscovery = false; }
    return true;
  }
  if (!pressed || !s.nearDiscovery) return false;
  s.activeDiscovery = s.nearDiscovery;
  if (s.nearDiscovery === 'note') s.noteRead = true;
  else if (s.nearDiscovery === 'crab') s.crabInvited = true;
  else {
    const target=s.nearDiscovery==='shell'?SHELL:KEEPSAKES.find(item=>item.id===s.nearDiscovery);
    startCharacterAction(s,'pickup',target,s.nearDiscovery);
    if (s.nearDiscovery === 'shell') s.shellFound = true;
    s.keepsakes = collectItem(s.keepsakes ?? [], s.nearDiscovery);
  }
  return true;
}

export function revealShell(s) { s.shellRevealed = true; }
