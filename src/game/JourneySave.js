import { NEEM_SEAT_EXIT } from './NeemSeat.js';
import { restoreHints } from './MessageFlow.js';
import {restoreChapterOne} from './ChapterOne.js';
import {BOATS, ROWBOAT} from './BoatProfiles.js';
import {Vector3} from 'three';
import {START, OPENING_APPROACH} from './WorldConfig.js';
import {worldCoastalRadiusAt} from './Seabed.js';
import {islandGroundAt} from './IslandGround.js';
import {walkingSurfaceHeight} from './WalkingSurface.js';
import {WORLD_LIMIT} from './AdiyogiTerrain.js';
import {createJourney} from './JourneyState.js';
export const JOURNEY_SAVE_KEY='port.journey.v1';
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<WORLD_LIMIT&&Math.abs(p.z)<WORLD_LIMIT;
const heading=value=>Number.isFinite(value)?value:0;
const walkable=p=>point(p)&&walkingSurfaceHeight(p.x,p.z)!==null&&!(Math.abs(p.z+12)<.7&&Math.abs(p.x)>1.1&&Math.abs(p.x)<9.3);

export function snapshotJourney(boat, journey) {
  // Do not resume an unattended boat sliding over land. A walking player's
  // parked boat can remain at its landing position for a natural return.
  const p=boat.beached&&journey.mode==='aboard' ? boat.safeWater??START : boat.position;
  const position=journey.benchSeated ? NEEM_SEAT_EXIT : journey.position;
  return {version:1, boat:{openingVoyage:boat.openingVoyage===true && Boolean(boat.destination),id:boat.boatId??'skiff',x:p.x,z:p.z,heading:heading(boat.heading),beached:Boolean(boat.beached&&journey.mode!=='aboard'),safeWater:boat.safeWater??START},
    journey:{seenHints:restoreHints(journey.seenHints),chapter:journey.chapter??null,noteRead:Boolean(journey.noteRead),crabInvited:Boolean(journey.crabInvited),shellRevealed:Boolean(journey.shellRevealed),shellFound:Boolean(journey.shellFound),mode:journey.mode,position:{x:position.x,z:position.z},landing:{x:journey.landing.x,z:journey.landing.z},heading:heading(journey.heading),released:journey.released,completed:journey.completed,releaseOrigin:journey.releaseOrigin}};
}
export function parseJourneySave(raw) {
  try {
    const data=JSON.parse(raw);
    if(data?.version!==1||!point(data.boat)||![...BOATS,ROWBOAT].some(b=>b.id===data.boat.id)||!['aboard','walking','resting'].includes(data.journey?.mode))return null;
    const s=data.journey;
    if(s.mode!=='aboard'&&(!walkable(s.position)||!walkable(s.landing)))return null;
    if(s.mode==='resting'&&!s.released)return null;
    if(s.releaseOrigin!=null&&!point(s.releaseOrigin))return null;
    // Never trust a stored water recovery location inside the island.
    const safe=point(data.boat.safeWater)&&worldCoastalRadiusAt(data.boat.safeWater.x,data.boat.safeWater.z)>1.1 ? data.boat.safeWater : START;
    data.boat.safeWater={x:safe.x,z:safe.z,heading:heading(safe.heading)};
    if(s.mode==='aboard'&&worldCoastalRadiusAt(data.boat.x,data.boat.z)<1.05)Object.assign(data.boat,safe,{beached:false});
    return data;
  }catch{return null;}
}
export function restoreJourney(data, boat, journey) {
  boat.boatId=data.boat.id; boat.position.set(data.boat.x,0,data.boat.z);
  boat.heading=heading(data.boat.heading); boat.speed=0; boat.velocity=undefined; boat.destination=null;
  boat.openingVoyage=data.boat.openingVoyage===true;
  boat.navigation=undefined;
  if(boat.openingVoyage && data.journey.mode==='aboard') boat.destination=new Vector3(OPENING_APPROACH.x,0,OPENING_APPROACH.z);
  else boat.openingVoyage=false;
  boat.beached=Boolean(data.boat.beached); boat.beachedTime=0; boat.safeWater=data.boat.safeWater;
  Object.assign(journey,createJourney(boat.resetId));
  const s=data.journey;
  journey.chapter=restoreChapterOne(s.chapter);
  if(journey.chapter)boat.boatId=journey.chapter.step==='complete'?'skiff':'rowboat';
  Object.assign(journey,{seenHints:restoreHints(s.seenHints),noteRead:s.noteRead===true,crabInvited:s.noteRead===true&&s.crabInvited===true,shellRevealed:s.shellRevealed===true||s.shellFound===true,shellFound:s.shellFound===true,mode:s.mode,heading:heading(s.heading),released:Boolean(s.released),completed:Boolean(s.completed&&s.released),releaseTime:s.released?8:0,restTime:s.completed?8:0});
  if(point(s.position))journey.position.set(s.position.x,walkingSurfaceHeight(s.position.x,s.position.z)??islandGroundAt(s.position.x,s.position.z),s.position.z);
  if(point(s.landing))journey.landing.set(s.landing.x,islandGroundAt(s.landing.x,s.landing.z),s.landing.z);
  if(s.released){const p=s.releaseOrigin??{x:0,z:-12.8};journey.releaseOrigin={x:p.x,y:islandGroundAt(p.x,p.z),z:p.z};}
  // The retired volunteer chapter stowed luggage without crossing the gate.
  // Put those saves back on the arrival side with their carried luggage.
  if (s.chapter?.version === 1 && journey.chapter) {
    Object.assign(journey, {released:false, completed:false, releaseTime:0, restTime:0, releaseOrigin:null});
    if (journey.mode !== 'aboard') {
      journey.mode = 'walking';
      journey.chapter.step = 'gate';
      journey.position.copy(journey.landing);
    }
  }
  return journey;
}
