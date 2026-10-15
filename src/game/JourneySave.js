import {BOATS} from './BoatProfiles.js';
import {START} from './WorldConfig.js';
import {worldCoastalRadiusAt} from './Seabed.js';
import {islandGroundAt} from './IslandGround.js';
import {walkingSurfaceHeight} from './WalkingSurface.js';
import {WORLD_LIMIT} from './AdiyogiTerrain.js';
import {createJourney} from './JourneyState.js';
export const JOURNEY_SAVE_KEY='port.journey.v1';
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<WORLD_LIMIT&&Math.abs(p.z)<WORLD_LIMIT;
const heading=value=>Number.isFinite(value)?value:0;
const dry=p=>point(p)&&worldCoastalRadiusAt(p.x,p.z)<.94&&!(Math.abs(p.z+12)<.7&&Math.abs(p.x)>1.1&&Math.abs(p.x)<9.3);
const walkable=p=>point(p)&&walkingSurfaceHeight(p.x,p.z)!==null&&!(Math.abs(p.z+12)<.7&&Math.abs(p.x)>1.1&&Math.abs(p.x)<9.3);

export function snapshotJourney(boat, journey) {
  // Do not resume an unattended boat sliding over land. A walking player's
  // parked boat can remain at its landing position for a natural return.
  const p=boat.beached&&journey.mode==='aboard' ? boat.safeWater??START : boat.position;
  return {version:1, boat:{id:boat.boatId??'skiff',x:p.x,z:p.z,heading:heading(boat.heading),beached:Boolean(boat.beached&&journey.mode!=='aboard'),safeWater:boat.safeWater??START},
    journey:{noteRead:Boolean(journey.noteRead),shellRevealed:Boolean(journey.shellRevealed),shellFound:Boolean(journey.shellFound),mode:journey.mode,position:{x:journey.position.x,z:journey.position.z},landing:{x:journey.landing.x,z:journey.landing.z},heading:heading(journey.heading),released:journey.released,completed:journey.completed,releaseOrigin:journey.releaseOrigin}};
}
export function parseJourneySave(raw) {
  try {
    const data=JSON.parse(raw);
    if(data?.version!==1||!point(data.boat)||!BOATS.some(b=>b.id===data.boat.id)||!['aboard','walking','resting'].includes(data.journey?.mode))return null;
    const s=data.journey;
    if(s.mode!=='aboard'&&(!walkable(s.position)||!dry(s.landing)))return null;
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
  boat.beached=Boolean(data.boat.beached); boat.beachedTime=0; boat.safeWater=data.boat.safeWater;
  Object.assign(journey,createJourney(boat.resetId));
  const s=data.journey;
  Object.assign(journey,{noteRead:s.noteRead===true,shellRevealed:s.shellRevealed===true||s.shellFound===true,shellFound:s.shellFound===true,mode:s.mode,heading:heading(s.heading),released:Boolean(s.released),completed:Boolean(s.completed&&s.released),releaseTime:s.released?8:0,restTime:s.completed?8:0});
  if(point(s.position))journey.position.set(s.position.x,walkingSurfaceHeight(s.position.x,s.position.z)??islandGroundAt(s.position.x,s.position.z),s.position.z);
  if(point(s.landing))journey.landing.set(s.landing.x,islandGroundAt(s.landing.x,s.landing.z),s.landing.z);
  if(s.released){const p=s.releaseOrigin??{x:0,z:-12.8};journey.releaseOrigin={x:p.x,y:islandGroundAt(p.x,p.z),z:p.z};}
  return journey;
}
