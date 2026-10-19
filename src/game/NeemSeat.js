import { NEEM_ISLAND, neemTerrainHeight } from './NeemTerrain.js';
export const NEEM_SEAT = Object.freeze({x:NEEM_ISLAND.x+2.2,z:NEEM_ISLAND.z+.6});
export const NEEM_SEAT_EXIT = Object.freeze({x:NEEM_SEAT.x,z:NEEM_SEAT.z+1.3});
export function nearNeemSeat(s) {
  return s.mode==='walking' && !s.jumping && Math.hypot(s.position.x-NEEM_SEAT_EXIT.x,s.position.z-NEEM_SEAT_EXIT.z)<1.25;
}
export function stepNeemSeat(s,pressed,controls,dt) {
  s.nearBench=nearNeemSeat(s);
  if(s.benchSeated) {
    s.seatTime+=dt;
    if(pressed || controls.forward || controls.backward || controls.left || controls.right || controls.brake) {
      s.benchSeated=false;s.seatTime=0;
      s.position.set(NEEM_SEAT_EXIT.x,neemTerrainHeight(NEEM_SEAT_EXIT.x,NEEM_SEAT_EXIT.z),NEEM_SEAT_EXIT.z);
    }
    return true;
  }
  if(!pressed || !s.nearBench || s.nearDiscovery || s.activeDiscovery)return false;
  s.benchSeated=true;s.seatTime=0;s.heading=Math.PI;s.velocityX=s.velocityZ=0;s.running=false;
  s.position.set(NEEM_SEAT.x,neemTerrainHeight(NEEM_SEAT.x,NEEM_SEAT.z),NEEM_SEAT.z);
  return true;
}
