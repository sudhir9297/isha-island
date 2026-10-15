import { gateGround } from './MalaiVasalGeometry.js';
// A narrow backward fan toward the arrival forecourt. Short flights keep
// the arc below the crown rock and make the release feel like a toss.
import { LUGGAGE_OFFSETS as OFFSETS } from './WorldMarkers.js';
export function createLuggageThrow(start,center,index) {
 const [dx,dz]=OFFSETS[index], x=center.x+dx,z=center.z+dz;
 const distance=Math.hypot(x-start.x,z-start.z)||1;
 const impact={x:x-(x-start.x)/distance*.24,z:z-(z-start.z)/distance*.24};
 impact.y=gateGround(impact.x,impact.z+12)+.27;
 return {impact,start:{x:start.x,y:start.y,z:start.z},end:{x,y:gateGround(x,z+12)+.27,z},duration:.76+index*.035,index};
}
export function sampleLuggageThrow(flight,time,out) {
 const {start,end,impact=end,duration,index}=flight, t=Math.max(0,Math.min(time,duration)), u=t/duration;
 const vy=(impact.y-start.y+7*duration*duration)/duration;
 out.x=start.x+(impact.x-start.x)*u;out.z=start.z+(impact.z-start.z)*u;
 out.y=start.y+vy*t-7*t*t;
 if(time>duration){const b=Math.min(1,(time-duration)/.32);const slide=1-(1-b)*(1-b);out.x=impact.x+(end.x-impact.x)*slide;out.z=impact.z+(end.z-impact.z)*slide;out.y=impact.y+(end.y-impact.y)*slide+Math.sin(b*Math.PI)*.16*(1-b);}
 out.spin=Math.min(1,time/duration)*(Math.PI*.75+index*.2);
 return out;
}
