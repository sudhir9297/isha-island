import { DOCK, dockWorldPoint } from './WalkingSurface.js';
import { seabedMaxHeightWithin } from './Seabed.js';
export const DOCK_FISH_CENTER = dockWorldPoint(0, DOCK.end + 1.7);
export const DOCK_FISH_LOOKOUT = dockWorldPoint(0, DOCK.end - .65);
const STEP=1/60;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function random(state) {
  state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;
  return state.seed/4294967296;
}
export function createDockFish() {
  const state={time:0,interest:0,fright:0,accumulator:0,seed:314159,nextGoal:0,goalX:DOCK_FISH_CENTER.x,goalZ:DOCK_FISH_CENTER.z+2,escapeX:0,escapeZ:0};
  state.fish=Array.from({length:12},(_,i)=>({
    x:DOCK_FISH_CENTER.x+(i%4-1.5)*.8,
    z:DOCK_FISH_CENTER.z+1.2+Math.floor(i/4)*.7,
    y:-.55-(i%3)*.09, heading:0, vx:.4, vz:.1,
    speed:.4, stroke:i*1.7, cruise:.48+random(state)*.24,
    turnBias:random(state)*Math.PI*2,
  }));
  state.forces=Array.from({length:12},()=>({x:0,z:0}));
  return state;
}
function swim(state,journey,boat) {
  const dt=STEP;
  const near=journey.mode==='walking' && Math.hypot(journey.position.x-DOCK_FISH_LOOKOUT.x,journey.position.z-DOCK_FISH_LOOKOUT.z)<3;
  const rushed=near && (journey.running || journey.jumping || Math.hypot(journey.velocityX||0,journey.velocityZ||0)>2.6);
  const boatClose=Math.hypot(boat.position.x-DOCK_FISH_CENTER.x,boat.position.z-DOCK_FISH_CENTER.z)<4 && Math.abs(boat.speed)>.7;
  if(rushed||boatClose) {
    state.fright=3.5;
    const threat=boatClose?boat.position:journey.position;
    state.escapeX=threat.x;state.escapeZ=threat.z;
  } else state.fright=Math.max(0,state.fright-dt);
  const target=near&&state.fright===0?1:0;
  state.interest+=(target-state.interest)*(1-Math.exp(-dt*(target?.65:3)));
  state.time+=dt;
  // A slowly changing foraging patch, not an assigned ring or orbit per fish.
  if(state.time>=state.nextGoal) {
    state.goalX=DOCK_FISH_CENTER.x+(random(state)-.5)*4;
    state.goalZ=DOCK_FISH_CENTER.z+.3+random(state)*2.7;
    state.nextGoal=state.time+4+random(state)*4;
  }
  // Compute every steering decision from the same frame of neighbours.
  for(let i=0;i<state.fish.length;i++) {
    const f=state.fish[i];let sx=0,sz=0,cx=0,cz=0,vx=0,vz=0,n=0;
    for(let j=0;j<state.fish.length;j++) {
      if(i===j)continue;
      const o=state.fish[j],dx=f.x-o.x,dz=f.z-o.z,d2=dx*dx+dz*dz;
      if(d2>2.5*2.5)continue;
      n++;cx+=o.x;cz+=o.z;vx+=o.vx;vz+=o.vz;
      if(d2<1.1*1.1) {
        const distance=Math.sqrt(d2)||.001, weight=(1.1-distance)/1.1;
        sx+=dx/distance*weight;sz+=dz/distance*weight;
      }
    }
    const goalX=state.goalX, goalZ=state.goalZ+(1-state.interest)*1.8;
    let ax=(goalX-f.x)*.16 + sx*3, az=(goalZ-f.z)*.16 + sz*3;
    if(n) {ax+=(vx/n-f.vx)*.65+(cx/n-f.x)*.09;az+=(vz/n-f.vz)*.65+(cz/n-f.z)*.09;}
    ax+=Math.sin(state.time*.55+f.turnBias)*.12;
    az+=Math.cos(state.time*.43+f.turnBias)*.12;
    if(state.fright>0) {
      const dx=f.x-state.escapeX,dz=f.z-state.escapeZ,d=Math.hypot(dx,dz)||1;
      const escape=2.4*Math.min(1,state.fright/1.5);
      ax+=dx/d*escape;az+=dz/d*escape;
    }
    // Soft boundaries keep the school in open water beyond the dock piles.
    const x=f.x-DOCK_FISH_CENTER.x,z=f.z-DOCK_FISH_CENTER.z;
    if(Math.abs(x)>4.5)ax-=Math.sign(x)*(Math.abs(x)-4.5)*2;
    if(z<.15)az+=(.15-z)*3;
    if(z>5.5)az-=(z-5.5)*2;
    const length=Math.hypot(ax,az),limit=state.fright?3:1.2;
    const scale=length>limit?limit/length:1;
    state.forces[i].x=ax*scale;state.forces[i].z=az*scale;
  }
  state.fish.forEach((f,i)=>{
    const force=state.forces[i],vx=f.vx+force.x*dt,vz=f.vz+force.z*dt;
    const oldAngle=Math.atan2(f.vz,f.vx),desired=Math.atan2(vz,vx);
    const turn=clamp(Math.atan2(Math.sin(desired-oldAngle),Math.cos(desired-oldAngle)),-dt*(state.fright?3:1.5),dt*(state.fright?3:1.5));
    const speed=clamp(Math.hypot(vx,vz),.18,state.fright?f.cruise*2.7:f.cruise);
    f.vx=Math.cos(oldAngle+turn)*speed;f.vz=Math.sin(oldAngle+turn)*speed;
    const nx=f.x+f.vx*dt,nz=f.z+f.vz*dt;
    if(seabedMaxHeightWithin(nx,nz,.55)<-.52) {f.x=nx;f.z=nz;}
    else {f.vx*=.95;f.vz=Math.abs(f.vz)+dt;}
    f.heading=-Math.atan2(f.vz,f.vx);
    f.speed=Math.hypot(f.vx,f.vz);f.stroke+=dt*(4+f.speed*9);
  });
}
export function stepDockFish(state,journey,boat,delta,paused=false) {
  if(paused)return state;
  state.accumulator+=Math.max(0,Math.min(.1,delta));
  while(state.accumulator>=STEP-1e-9) {
    swim(state,journey,boat);state.accumulator-=STEP;
  }
  return state;
}
export function dockFishTarget(state,index) { return state.fish[index]; }
