import { dockSurfaceHeight } from './WalkingSurface.js';
import { worldCoastalRadiusAt } from './Seabed.js';
import { islandGroundAt } from './IslandGround.js';
export function isTrackSand(x,z,y) {
  const radius=worldCoastalRadiusAt(x,z);
  const ground=islandGroundAt(x,z);
  return radius>.54 && radius<.97 && dockSurfaceHeight(x,z)===null && Math.abs(y-ground)<.16;
}
export function createTrackPool(limit=128) {return {marks:Array.from({length:limit},()=>({age:Infinity})),next:0,last:null,side:1};}
export function stepTracks(pool,position,heading,delta,enabled,crab=false) {
  const dt=Math.max(0,Math.min(.05,delta)), life=crab?48:28;
  for(const mark of pool.marks)mark.age+=dt;
  if(!enabled){pool.last=null;return;}
  if(!pool.last){pool.last={x:position.x,z:position.z};return;}
  const distance=Math.hypot(position.x-pool.last.x,position.z-pool.last.z);
  if(distance>2){pool.last={x:position.x,z:position.z};return;}
  if(distance<(crab?.18:.45))return;
  pool.last={x:position.x,z:position.z};pool.side*=-1;
  const offset=crab?0:pool.side*.12;
  const x=position.x+Math.cos(heading)*offset,z=position.z-Math.sin(heading)*offset;
  if(!isTrackSand(x,z,position.y))return;
  Object.assign(pool.marks[pool.next],{x,z,y:islandGroundAt(x,z)+.018,heading,age:0,life});
  pool.next=(pool.next+1)%pool.marks.length;
}
export function trackFadeBucket(mark) {return Math.min(8,Math.floor(mark.age/mark.life*8));}
