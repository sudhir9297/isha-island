import { dockWorldPoint } from './WalkingSurface.js';
export const DOCK_NOTE = dockWorldPoint(-0.35, 5.65);
export const SHELL = { x: -4.4, z: -5.7 };
export const DISCOVERIES = {
  note: { title: 'Leave your burdens behind', text: 'You’ve carried enough. Walk through Malai Vasal.', detail: 'Follow the little red crab slowly. Give it some space, and you’ll find a hidden shell.' },
  shell: { title: 'You found a shell', text: 'Slow down. There’s more here for you to discover.', detail: 'Leave the shell on the beach. You can revisit this moment in your field notes.' },
};
export function nearbyDiscovery(s) {
  if (s.mode !== 'walking' || s.jumping) return null;
  const near = p => Math.hypot(s.position.x-p.x,s.position.z-p.z)<1.1;
  if (!s.noteRead && near(DOCK_NOTE)) return 'note';
  if (s.shellRevealed && !s.shellFound && near(SHELL)) return 'shell';
  return null;
}
export function interactDiscovery(s, pressed) {
  s.nearDiscovery = nearbyDiscovery(s);
  if (s.activeDiscovery) {
    if (pressed || s.dismissDiscovery) { s.activeDiscovery = null; s.dismissDiscovery = false; }
    return true;
  }
  if (!pressed || !s.nearDiscovery) return false;
  s.activeDiscovery = s.nearDiscovery;
  if (s.nearDiscovery === 'note') s.noteRead = true;
  else s.shellFound = true;
  return true;
}

export function revealShell(s) { s.shellRevealed = true; }
