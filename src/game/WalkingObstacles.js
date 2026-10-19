import { Ray, Vector3 } from 'three';

// Static solid geometry is indexed once in world space. Leaves, terrain, foam
// and effects deliberately do not participate. Queries visit nearby cells only.
export function createWalkingObstacles(meshes, radius = .3) {
  const cells = new Map(), size = 2;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const points = [a,b,c].map((v,k) => v.fromBufferAttribute(p,index ? index.getX(i+k) : i+k).applyMatrix4(mesh.matrixWorld).clone());
      const minY = Math.min(...points.map(v=>v.y)), maxY = Math.max(...points.map(v=>v.y));
      const tri = {points, minY, maxY, mesh};
      const minX=Math.floor((Math.min(...points.map(v=>v.x))-radius)/size), maxX=Math.floor((Math.max(...points.map(v=>v.x))+radius)/size);
      const minZ=Math.floor((Math.min(...points.map(v=>v.z))-radius)/size), maxZ=Math.floor((Math.max(...points.map(v=>v.z))+radius)/size);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
        const key=`${x},${z}`; if(!cells.has(key))cells.set(key,[]); cells.get(key).push(tri);
      }
    }
  }
  const ray=new Ray(new Vector3(),new Vector3(0,1,0)), hit=new Vector3();
  return (x,z,floor) => {
    ray.origin.set(x,floor+.2,z);
    const crossings=new Map();
    for(const tri of cells.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)??[]) {
      if(ray.intersectTriangle(...tri.points,false,hit)){
        const heights=crossings.get(tri.mesh)??[];
        if(!heights.some(y=>Math.abs(y-hit.y)<1e-5))heights.push(hit.y);
        crossings.set(tri.mesh,heights);
      }
      if(tri.maxY < floor+.08 || tri.minY > floor+1.65)continue;
      let positive=false,negative=false;
      for(let i=0;i<3;i++){
        const a=tri.points[i],b=tri.points[(i+1)%3],dx=b.x-a.x,dz=b.z-a.z;
        const cross=dx*(z-a.z)-dz*(x-a.x);positive ||= cross>1e-8;negative ||= cross< -1e-8;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
        if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2 < radius*radius)return true;
      }
      if(positive!==negative)return true;
    }
    return [...crossings.values()].some(heights=>heights.length%2===1);
  };
}

// Small substeps prevent tunnelling; axis fallback lets the player slide along
// props instead of losing all movement when one shoulder contacts a surface.
export function slideWalkingMove(x,z,dx,dz,canEnter) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
  for(let i=0;i<steps;i++){
    const sx=dx/steps,sz=dz/steps;
    if(canEnter(x+sx,z+sz)){x+=sx;z+=sz;}
    else if(canEnter(x+sx,z))x+=sx;
    else if(canEnter(x,z+sz))z+=sz;
  }
  return {x,z};
}
