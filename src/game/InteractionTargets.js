import { DOCK_NOTE, SHELL } from './Discoveries.js';
import { KEEPSAKES } from './Keepsakes.js';
import { ACTIVITIES, DOCK_BELL } from './IslandActivities.js';
import { NEEM_SEAT } from './NeemSeat.js';
import { REST_SPOT } from './StoryMoments.js';
import { walkingSurfaceHeight } from './WalkingSurface.js';
export function interactionTarget(s) {
  if(s.activeDiscovery || s.benchSeated || s.jumping || s.action)return null;
  if(s.mode==='aboard')return s.canLand?s.availableLanding:null;
  if(s.mode!=='walking')return null;
  let p;
  if(s.nearDiscovery) p=s.nearDiscovery==='note'?DOCK_NOTE:s.nearDiscovery==='shell'?SHELL:s.nearDiscovery==='crab'?s.crabPosition:KEEPSAKES.find(item=>item.id===s.nearDiscovery);
  else if(s.nearBench)p=NEEM_SEAT;
  else if(s.nearActivity)p=s.nearActivity==='bell'?DOCK_BELL:ACTIVITIES[s.nearActivity];
  else if(s.nearRest)p=REST_SPOT;
  else if(Math.hypot(s.position.x-s.landing.x,s.position.z-s.landing.z)<1.7)p=s.landing;
  if(!p)return null;
  return {x:p.x,z:p.z,y:p.y??walkingSurfaceHeight(p.x,p.z)??s.position.y};
}
