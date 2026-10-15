import { coastalRadiusAt } from './Seabed.js';
import { dockSurfaceHeight } from './WalkingSurface.js';
const STEP = 0.35;
export function crabWalkable(x, z) {
  return dockSurfaceHeight(x, z - 12) !== null || (z >= 2 && coastalRadiusAt(x, z - 12) < 0.93);
}
const nodes = [], lookup = new Map();
for (let iz = 6; iz <= 38; iz++) for (let ix = -31; ix <= 31; ix++) {
  const x = ix * STEP, z = iz * STEP;
  if (crabWalkable(x,z)) { lookup.set(`${ix},${iz}`,nodes.length); nodes.push({x,z,ix,iz}); }
}
const neighbors = nodes.map(n => {
  const result=[];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const index=lookup.get(`${n.ix+dx},${n.iz+dz}`);
    if(index===undefined)continue;
    if(dx&&dz&&(!lookup.has(`${n.ix+dx},${n.iz}`)||!lookup.has(`${n.ix},${n.iz+dz}`)))continue;
    let safe=true;
    for(let i=1;i<20;i++)if(!crabWalkable(n.x+dx*STEP*i/20,n.z+dz*STEP*i/20)){safe=false;break;}
    if(!safe)continue;
    result.push(index);
  }
  return result;
});
function nearest(x,z) {
  let best=0, distance=Infinity;
  nodes.forEach((n,i)=>{const d=(n.x-x)**2+(n.z-z)**2;if(d<distance){distance=d;best=i;}});
  return best;
}
export function crabDestination(random) {
  // Regular dock visits, with most wandering still on the beach.
  const candidates = random() < 0.25 ? nodes.filter(n=>n.z>8.5) : nodes;
  return candidates[Math.floor(random()*candidates.length)];
}
export function crabPath(x,z,tx,tz) {
  const start=nearest(x,z),end=nearest(tx,tz),previous=new Int32Array(nodes.length).fill(-1),queue=[start];
  previous[start]=start;
  for(let head=0;head<queue.length&&previous[end]<0;head++) {
    const current=queue[head];
    for(const next of neighbors[current])if(previous[next]<0){previous[next]=current;queue.push(next);}
  }
  if(previous[end]<0)return [];
  const path=[];
  for(let n=end;n!==start;n=previous[n])path.push(nodes[n]);
  path.push(nodes[start]);
  path.reverse();
  if(crabWalkable(tx,tz) && Math.hypot(nodes[end].x-tx,nodes[end].z-tz)<0.3)path.push({x:tx,z:tz});
  return path;
}

export function crabEscapeTarget(x,z,px,pz) {
  let best=null,score=-Infinity;
  for(const n of nodes) {
    const travel=Math.hypot(n.x-x,n.z-z);
    if(travel<1.2||travel>3.8)continue;
    const value=Math.hypot(n.x-px,n.z-pz)-travel*0.12;
    if(value>score){score=value;best=n;}
  }
  return best??{x,z};
}
