import {useEffect,useMemo} from 'react';
import {BufferAttribute,Color,BufferGeometry} from 'three';
import {gateGround} from './MalaiVasalGeometry.js';
// A shallow, sand-buried threshold, batched into a single opaque draw.
export default function GateThreshold(){
  const geometry=useMemo(()=>{
    const positions=[],colors=[];
    const add=(points,color)=>{const c=new Color(color);for(const p of points){positions.push(...p);colors.push(c.r,c.g,c.b);}};
    for(let row=0;row<2;row++)for(let col=0;col<5;col++){
      const x=-1.14+col*.46,z=-.43+row*.44;
      const corners=[[x+.025,z+.025],[x+.435,z+.015],[x+.445,z+.415],[x+.015,z+.425]].map(([a,b])=>[a,gateGround(a,b)+.022,b]);
      const middle=[x+.23,gateGround(x+.23,z+.22)+.038,z+.22];
      for(let i=0;i<4;i++)add([middle,corners[(i+1)%4],corners[i]],['#aaa69b','#bcb8ab','#c4bfb1','#b0ada3'][(row+col+i)%4]);
    }
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="Sand buried stone threshold" geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1}/></mesh>;
}
