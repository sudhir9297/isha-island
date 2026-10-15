import { Raycaster, Vector3 } from 'three';
import { gateGround } from './MalaiVasalGeometry.js';
import { dockSurfaceHeight } from './WalkingSurface.js';

// Cache static geometry heights on a small grid. Only new cells cast rays;
// interpolating them keeps tiny feet smooth over faceted rocks and plank edges.
export function createCrabSurface(meshes) {
  const cache=new Map(), ray=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,10), hits=[];
  const step=0.12;
  function sample(ix,iz) {
    const key=`${ix},${iz}`;
    if(cache.has(key))return cache.get(key);
    const x=ix*step,z=iz*step;
    let height=Math.max(gateGround(x,z),dockSurfaceHeight(x,z-12)??-Infinity);
    ray.ray.origin.set(x,8,z-12);hits.length=0;
    ray.intersectObjects(meshes,false,hits);
    if(hits.length)height=Math.max(height,hits[0].point.y);
    cache.set(key,height);return height;
  }
  return (x,z)=>{
    const ix=Math.floor(x/step),iz=Math.floor(z/step),u=x/step-ix,v=z/step-iz;
    return (sample(ix,iz)*(1-u)+sample(ix+1,iz)*u)*(1-v)
      +(sample(ix,iz+1)*(1-u)+sample(ix+1,iz+1)*u)*v;
  };
}
