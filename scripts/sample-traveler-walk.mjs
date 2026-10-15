import {writeFileSync} from 'node:fs';
import {travelerLegPose, travelerUpperPose, WALK_HIP_HEIGHT} from '../src/game/TravelerGait.js';
const frames=Array.from({length:25},(_,i)=>{
  const phase=i/24*Math.PI*2;
  return {frame:i+1,cloth:[.5+.5*Math.cos(phase),.5-.5*Math.cos(phase)],hipHeight:WALK_HIP_HEIGHT,upper:travelerUpperPose(phase,1),
    legs:[travelerLegPose(phase,1),travelerLegPose(phase+Math.PI,1)],
    elbows:[travelerUpperPose(phase,1).elbow,travelerUpperPose(phase+Math.PI,1).elbow]};
});
writeFileSync(new URL('../assets/characters/walk-cycle.json',import.meta.url),JSON.stringify(frames,null,2)+'\n');
