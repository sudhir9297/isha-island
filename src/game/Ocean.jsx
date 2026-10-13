import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  DataTexture,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Plane,
  RepeatWrapping,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { SEABED_Y } from "./WorldConfig.js";
import { WATER_OPTICS_GLSL, createCausticField, OCEAN_SEA_LEVEL } from "./WaterOptics.js";
import { createSeabedGeometry, createSeabedFieldTexture, createSeabedMaterialTexture, COAST_SAND_ALBEDO, SEABED_GRID, SEABED_GLSL, SEABED_MAX_Y } from "./Seabed.js";

const SEA_LEVEL = OCEAN_SEA_LEVEL;
function causticTexture() {
  const field = createCausticField();
  const texture = new DataTexture(field.data, field.size, field.size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  texture.userData.meanFocusing = field.meanFocusing;
  return texture;
}
// Dense geometry resolves the calm surface around the island and all close
// boat paths. Its tapered outer rows join a flat far ocean without extra draws.
function createOceanGeometry() {
  const coordinates = [-250, -140, -80, -60];
  for (let i = 0; i < 25; i++) coordinates.push(-48 + i * .48);
  for (let i = 0; i <= 300; i++) coordinates.push(-36 + i * .24);
  for (let i = 1; i <= 25; i++) coordinates.push(36 + i * .48);
  coordinates.push(60, 80, 140, 250);
  const positions = [], indices = [], count = coordinates.length;
  for (const z of coordinates) for (const x of coordinates) positions.push(x, 0, z);
  for (let z = 0; z < count - 1; z++) for (let x = 0; x < count - 1; x++) {
    const a = z * count + x, b = a + 1, c = a + count;
    indices.push(a, c, b, b, c, c + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
const vertex = `
#include <common>
uniform float uTime;
${SEABED_GLSL}
${WATER_OPTICS_GLSL}
varying vec3 vWorld;
varying vec4 vClip;
void main(){
 vec4 world=modelMatrix*vec4(position,1.0);
 world.y+=waterSurface(world.xz,uTime,seabedSample(world.xz)).x;
 vWorld=world.xyz;
 vClip=projectionMatrix*viewMatrix*world;
 gl_Position=vClip;
}`;
const bedVertex = `
varying vec3 vWorld;
void main(){
 vec4 world=modelMatrix*vec4(position,1.0);
 vWorld=world.xyz;
 gl_Position=projectionMatrix*viewMatrix*world;
}`;
const shared = `
${SEABED_GLSL}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec2 ripple(vec2 p,float t){
 return vec2(sin(p.x*1.73+p.y*1.11+t*.53)+sin(p.y*3.1-t*.39),
             cos(p.y*1.94-p.x*.89+t*.42)+sin(p.x*2.47+t*.28))*.5;
}
vec3 floorColor(vec2 p,float d){
 float seaVariation=(noise(p*.09+vec2(17.,9.))-.5)*.09;
 float deepLight=1.-smoothstep(.8,2.1,d)*.1+seaVariation;
 if(d>=1.35)return uDeep*deepLight;
 float mottling=(noise(p*.55)-.5)*.065+(noise(p*2.8)-.5)*.024;
 float shelfPattern=noise(p*.18+vec2(3.1,1.7))*.65+noise(p*.43+vec2(8.2,2.3))*.35;
 float shelfVariation=(shelfPattern-.5)*.19*smoothstep(.025,.22,d)*(1.-smoothstep(.8,1.4,d));
 // Actual water-column depth carries the authored unequal coastal slopes.
 float depth=max(.0,-.08-seabedHeight(p))+(mottling+shelfVariation)*.7;
  vec3 c=mix(uSand,uMint,smoothstep(.07,.43,depth));
 c=mix(c,uAqua,smoothstep(.38,.91,depth));
 c=mix(c,uLagoon,smoothstep(.82,1.62,depth));
 c=mix(c,uDeep,smoothstep(1.48,2.35,depth));
 return c*deepLight;
}
`;
const seabedFrag = `
uniform float uTime;uniform vec3 uDeep,uLagoon,uShallow,uSand,uMint,uAqua;
varying vec3 vWorld;
${shared}
void main(){
 vec2 p=vWorld.xz;float d=shore(p);
 vec3 c=floorColor(p,d);
 gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}`;
const waterFrag = `
uniform float uTime;
uniform vec3 uDeep,uLagoon,uShallow,uSand,uFoam,uCoastSand,uMint,uAqua;
uniform sampler2D uUnderwater,uDepth,uCaustics;
uniform float uCausticMean;
uniform mat4 uInverseProjection,uCameraWorld;
uniform vec2 uResolution;
varying vec3 vWorld;
varying vec4 vClip;
#include <common>
#include <packing>
#include <tonemapping_pars_fragment>
uniform sampler2DShadow uSunDepth;
uniform mat4 uSunMatrix;
uniform float uSunReady;
uniform vec2 uSunTexel;
uniform vec3 uSunDirection,uSunRadiance;
${WATER_OPTICS_GLSL}
float sunVisibility(vec3 world){
 if(uSunReady<.5)return 1.;
 vec4 projected=uSunMatrix*vec4(world+vec3(0.,.035,0.),1.);
 vec3 q=projected.xyz/projected.w;
 if(q.x<0.||q.y<0.||q.x>1.||q.y>1.||q.z>1.)return 1.;
 float sum=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  float spread=2.+max(0.,-.08-world.y)*1.1;
  sum+=texture(uSunDepth,vec3(q.xy+vec2(float(x),float(y))*uSunTexel*spread,q.z-.00025));
 }
 return sum/9.;
}
${shared}
vec3 positionFromDepth(vec2 uv,float depth){
 vec4 view=uInverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
 return (uCameraWorld*vec4(view.xyz/view.w,1.)).xyz;
}
float receiverFocusing(vec2 receiver){
 vec2 drift=ripple(receiver,uTime);
 vec2 uv=receiver*.12+drift*.014+uTime*vec2(.005,-.003);
 return texture2D(uCaustics,uv).r*.72
  +texture2D(uCaustics,uv*1.63+drift*.02-uTime*.004).r*.28;
}
void main(){
 vec2 p=vWorld.xz;float d=shore(p);
 vec3 surfaceNormal=waterNormal(p,uTime,seabedSample(p));
 vec3 viewDirection=normalize(uCameraWorld[2].xyz);
 vec3 normalDelta=surfaceNormal-vec3(0.,1.,0.);
 vec2 refractOffset=vec2(dot(normalDelta,uCameraWorld[0].xyz),dot(normalDelta,uCameraWorld[1].xyz))*8.;
 vec2 screen=vClip.xy/vClip.w*.5+.5;
 vec2 distorted=clamp(screen+refractOffset/uResolution,vec2(.002),vec2(.998));
 vec4 under=texture2D(uUnderwater,distorted);
 float capturedDepth=texture2D(uDepth,distorted).r;
 vec3 below=positionFromDepth(distorted,capturedDepth);
 float viewCos=clamp(dot(surfaceNormal,viewDirection),.001,1.);
 float sunCos=clamp(uSunDirection.y,.001,1.);
 // Uncolored pixels are trusted only when depth matches the physical floor.
 vec3 floorSample=vec3(0.);
 vec3 floorPosition=vec3(0.);
 vec2 floorUV=vec2(0.);
 bool capturedFloor=false;
 if(under.a<.01&&capturedDepth<.99999){
  vec3 capturedFloorSample=seabedSample(below.xz);
  if(abs(below.y-capturedFloorSample.x)<.02){
   floorPosition=below;floorUV=below.xz;floorSample=capturedFloorSample;
   capturedFloor=true;
  }
 }
 if(!capturedFloor){
  // Bracket the actual camera ray against the shared triangle field. Bisection
  // remains stable on steep coastal shelves and at low camera elevations.
  vec2 raySlope=uCameraWorld[2].xz/uCameraWorld[2].y;
  vec3 nearPoint=positionFromDepth(distorted,0.);
  vec2 rayWater=nearPoint.xz+(vWorld.y-nearPoint.y)*raySlope;
  float low=uSeabedGrid.w,high=uSeabedMaxHeight;
  for(int i=0;i<13;i++){
   float height=(low+high)*.5;
   vec2 candidate=rayWater+(height-vWorld.y)*raySlope;
   if(height>seabedHeight(candidate))high=height;else low=height;
  }
  floorUV=rayWater+((low+high)*.5-vWorld.y)*raySlope;
  floorSample=seabedSample(floorUV);
  floorPosition=vec3(floorUV.x,floorSample.x,floorUV.y);
 }
 float floorDepth=max(.0,vWorld.y-floorPosition.y);
 float floorShore=shore(floorUV);
 float coastalDepth=floorDepth/2.35;
 float relief=max(.0,floorPosition.y-uSeabedGrid.w);
 vec3 c=floorColor(floorUV,floorShore);
 // These shallow anchors are perceptual colors. Undo only Neutral's black offset,
 // then composite once in linear radiance; deep calibration remains unchanged.
 c=mix(c,paletteRadianceForNeutral(c),1.-smoothstep(1.45,2.2,floorDepth));
 vec3 floorNormal=normalize(vec3(-floorSample.y,1.,-floorSample.z));
 float daylight=.58+.42*max(.0,dot(floorNormal,uSunDirection));
 float grain=noise(floorUV*1.8)*.65+noise(floorUV*4.6)*.35;
 vec3 silt=mix(vec3(.18,.24,.20),vec3(.29,.33,.245),grain);
 vec3 coastSand=uCoastSand*(.97+.06*grain);
 vec3 sediment=mix(coastSand,silt,seabedSiltWeight(floorUV))*daylight;
 float floorSun=sunVisibility(floorPosition);
 float shallows=max(1.-smoothstep(.12,.85,coastalDepth),(1.-smoothstep(.75,2.35,floorDepth))*.8);
 float floorShadow=(1.-floorSun)*shallows*exp(-floorDepth*.42);
 sediment*=1.-floorShadow*.43;
 sediment=waterReceiverRadiance(sediment,receiverFocusing(floorUV),uCausticMean,floorDepth,floorSun);
 vec3 scatterColor=mix(uShallow,uLagoon,smoothstep(.15,2.,floorDepth));
 sediment=waterRadiance(sediment,scatterColor,floorDepth,viewCos,sunCos);
 // A gradual change in real water depth reveals irregular silty shoulders.
 float sedimentVisibility=(1.-exp(-relief*1.1))*(.42+.12*noise(floorUV*.73));
 // Shadow the empirical bottom palette before mixing illuminated path radiance.
 c*=1.-floorShadow*.43;
 c=mix(c,sediment,sedimentVisibility);
 float submerged=step(below.y,vWorld.y-.001)*under.a;
 if(submerged>.01){
  float depth=max(0.,vWorld.y-below.y);
  float viewPath=depth/waterRefractedCos(viewCos);
  // A small bilateral footprint models surface roughness without borrowing
  // foreground shore colors or spreading object color onto empty floor pixels.
  vec3 radiance=under.rgb;
  float totalWeight=1.;
  float blurRadius=min(1.4,viewPath*.35);
  for(int i=0;i<4;i++){
   vec2 direction=i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.);
   vec2 uv=clamp(distorted+direction*blurRadius/uResolution,vec2(.002),vec2(.998));
   vec4 sampleColor=texture2D(uUnderwater,uv);
   vec3 sampleWorld=positionFromDepth(uv,texture2D(uDepth,uv).r);
   if(sampleColor.a>.01&&sampleWorld.y<vWorld.y-.001){
    float difference=abs(sampleWorld.y-below.y);
    float weight=exp(-difference*difference/(.025+.025*depth))*.25;
    radiance+=sampleColor.rgb*weight;totalWeight+=weight;
   }
  }
  radiance/=totalWeight;
  vec3 volumeColor=mix(uShallow,uLagoon,smoothstep(.15,2.,depth));
  radiance=waterReceiverRadiance(radiance,receiverFocusing(below.xz),uCausticMean,depth,sunVisibility(below));
  vec3 reef=waterRadiance(radiance,volumeColor,depth,viewCos,sunCos);
  c=mix(c,reef,submerged);
 }

 // Surface reflection follows the same wave normal as refraction. Its Fresnel
 // energy and rough sun response use the actual camera and directional light.
 float fresnel=waterFresnel(viewCos);
 vec3 reflectionDirection=reflect(-viewDirection,surfaceNormal);
 vec2 skyUV=reflectionDirection.xz/max(.15,abs(reflectionDirection.y));
 float skyCloud=smoothstep(.7,.9,noise(skyUV*.8+vec2(uTime*.003,0.)));
 vec3 sky=vec3(.012,.36,.64)+vec3(.10,.055,.035)*skyCloud*.28;
 float roughness=waterSurfaceRoughness(p,uTime);
 float sunSpecular=waterSunSpecular(surfaceNormal,viewDirection,uSunDirection,roughness);
 // The calm lagoon uses a filtered solar disk, with restrained reflected exposure.
 float reflectionShelter=1.-smoothstep(.8,2.2,floorDepth);
 float solarExposure=mix(.044,.22,reflectionShelter);
 c=c*(1.-fresnel)+sky*fresnel+uSunRadiance*sunSpecular*solarExposure;

 // A broken swash front travels shoreward across the real shallow bed.
 // Screen-space filtering keeps the narrow edge visible without shimmering.
 float localDepth=max(0.,vWorld.y-seabedHeight(p));
 if(d<.12&&localDepth<.46){
  float arrival=uTime*.95+noise(p*.22)*2.4;
  float surge=.5+.5*sin(arrival);
  float frontDepth=mix(.025,.25,surge);
  float width=max(.033,fwidth(localDepth)*1.4);
  float front=exp(-pow((localDepth-frontDepth)/width,2.));
  vec2 drift=p*3.8+vec2(uTime*.12,-uTime*.09);
  float flecks=noise(drift);
  float patches=noise(p*1.4+vec2(-uTime*.055,uTime*.025));
  float breakup=mix(.3,1.,smoothstep(.22,.72,patches));
  float lace=mix(.45,1.,smoothstep(.28,.64,flecks));
  float advancing=.5+.5*cos(arrival);
  float crest=front*breakup*lace*(.6+.25*advancing);
  // Sparse bubbles linger shoreward of the crest, then dissolve on retreat.
  float film=(1.-smoothstep(frontDepth,frontDepth+.05,localDepth))
    *smoothstep(.005,.04,localDepth)*(1.-smoothstep(.18,.38,localDepth));
  float bubbles=smoothstep(.64,.8,noise(drift*2.1))*film*.18;
  float edgeFade=1.-smoothstep(.32,.46,localDepth);
  c=mix(c,uFoam,clamp((crest+bubbles)*edgeFade,0.,.82));
 }

 gl_FragColor=vec4(NeutralToneMapping(c),1.);
 #include <colorspace_fragment>
}`;

export default function Ocean({ onSail, sunRef, quality = "high" }) {
  const bed = useRef(),
    terrain = useRef(),
    water = useRef();
  const size = useThree((state) => state.size);
  const scene = useThree((state) => state.scene);
  const aboveWater = useRef([]);
  const hiddenThisPass = useRef([]);
  const resources = useMemo(() => {
    const caustics = causticTexture();
    const terrainGeometry = createSeabedGeometry();
    const waterGeometry = createOceanGeometry();
    const seabedField = createSeabedFieldTexture();
    const seabedMaterial = createSeabedMaterialTexture();
    const seabedUniforms = {
      uSeabedField: { value: seabedField },
      uSeabedMaterial: { value: seabedMaterial },
      uSeabedGrid: { value: new Vector4(SEABED_GRID.x, SEABED_GRID.z, SEABED_GRID.step, SEABED_Y) },
      uSeabedSize: { value: new Vector2(SEABED_GRID.columns, SEABED_GRID.rows) },
      uSeabedMaxHeight: { value: SEABED_MAX_Y },
    };
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: true,
      samples: 2,
    });
    target.depthTexture = new DepthTexture(1, 1);
    return {
      target,
      caustics,
      terrainGeometry,
      waterGeometry,
      seabedField,
      seabedMaterial,
      bedUniforms: {
        ...seabedUniforms,
        uTime: { value: 0 },
        uDeep: { value: new Color("#085478") },
        uLagoon: { value: new Color("#188791") },
        uShallow: { value: new Color("#55aa99") },
        uSand: { value: new Color("#d0d39c") },
        uMint: { value: new Color("#9fc4a5") },
        uAqua: { value: new Color("#54b5ac") },
      },
      // The color-only floor is hidden from the capture. Buried reef geometry must
      // still be occluded by its physical depth, otherwise its skirts ghost through.
      clip: [
        new Plane(new Vector3(0, -1, 0), SEA_LEVEL + 0.1),
        new Plane(new Vector3(0, 1, 0), -SEABED_Y),
      ],
      uniforms: {
        ...seabedUniforms,
        uSunDirection: { value: new Vector3(22, 28, -22).normalize() },
        uSunRadiance: { value: new Color("#fff1d6").multiplyScalar(3.2) },
        uSunDepth: { value: null },
        uSunMatrix: { value: new Matrix4() },
        uSunReady: { value: 0 },
        uSunTexel: { value: new Vector2(1 / 2048, 1 / 2048) },
        uTime: { value: 0 },
        uDeep: { value: new Color("#085478") },
        uLagoon: { value: new Color("#188791") },
        uShallow: { value: new Color("#55aa99") },
        uSand: { value: new Color("#d0d39c") },
        uMint: { value: new Color("#9fc4a5") },
        uAqua: { value: new Color("#54b5ac") },
        uFoam: { value: new Color("#f0fbf7") },
        uCoastSand: { value: new Color().fromArray(COAST_SAND_ALBEDO) },
        uUnderwater: { value: target.texture },
        uCaustics: { value: caustics },
        uCausticMean: { value: caustics.userData.meanFocusing },
        uDepth: { value: target.depthTexture },
        uInverseProjection: { value: new Matrix4() },
        uCameraWorld: { value: new Matrix4() },
        uResolution: { value: new Vector2(1, 1) },
        toneMappingExposure: { value: 1 },
      },
    };
  }, []);
  const resourceRef = useRef(resources);
  // Cache static island and above-water boat parts. No scene traversal occurs in the frame loop.
  // A generous gap above sea leaves bobbing hulls and shoreline geometry in the clipped pass.
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const bounds = new Box3(),
      candidates = [];
    scene.traverse((object) => {
      if (!object.isMesh) return;
      // Surface foam uses custom shaders that do not consume global clipping
      // chunks. Check its semantic group before excluding instanced meshes.
      let ancestor = object;
      while (ancestor) {
        if (ancestor.userData.seaSurfaceOnly) {
          candidates.push(object);
          return;
        }
        ancestor = ancestor.parent;
      }
      if (
        object.isInstancedMesh ||
        object === bed.current ||
        object === terrain.current ||
        object === water.current
      )
        return;
      bounds.setFromObject(object);
      if (bounds.min.y > 0.15) candidates.push(object);
    });
    aboveWater.current = candidates;
  });
  useEffect(() => {
    const { target, uniforms } = resourceRef.current;
    const maxDimension = quality === "high" ? 900 : 560;
    const scale = Math.min(1, maxDimension / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    target.samples = quality === "high" ? 2 : 0;
    target.setSize(width, height);
    uniforms.uResolution.value.set(width, height);
  }, [size.width, size.height, quality]);
  useEffect(() => {
    const { target, caustics, terrainGeometry, waterGeometry, seabedField, seabedMaterial } = resourceRef.current;
    return () => {
      target.dispose();
      caustics.dispose();
      terrainGeometry.dispose();
      waterGeometry.dispose();
      seabedField.dispose();
      seabedMaterial.dispose();
    };
  }, []);
  // Negative priority runs after CameraRig and keeps Fiber's final scene render automatic.
  // This pass reuses the current shadow map and restores every changed renderer/scene setting.
  useFrame(({ gl, scene, camera, clock }) => {
    if (!bed.current || !terrain.current || !water.current) return;
    const { uniforms, target, clip } = resourceRef.current;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.toneMappingExposure.value = gl.toneMappingExposure;
    const previousTarget = gl.getRenderTarget();
    const previousClipping = gl.clippingPlanes;
    const previousBackground = scene.background;
    const previousShadowUpdate = gl.shadowMap.autoUpdate;
    const previousAlpha = gl.getClearAlpha();
    bed.current.visible = false;
    // Render the real raised floor first into depth, with zero color/alpha.
    // This occludes buried reef/wildlife without placing a colored patch in the capture.
    const previousTerrainColorWrite = terrain.current.material.colorWrite;
    const previousTerrainVisibility = terrain.current.visible;
    terrain.current.visible = true;
    terrain.current.material.colorWrite = false;
    water.current.visible = false;
    scene.background = null;
    gl.clippingPlanes = clip;
    gl.shadowMap.autoUpdate = false;
    gl.setClearAlpha(0);
    gl.setRenderTarget(target);
    const hidden = hiddenThisPass.current;
    hidden.length = 0;
    for (const object of aboveWater.current) {
      if (object.visible) {
        hidden.push(object);
        // eslint-disable-next-line react/immutability -- Three.js mesh visibility is imperative renderer state.
        object.visible = false;
      }
    }
    try {
      gl.clear();
      gl.render(scene, camera);
      const metricRoot = document.querySelector("main.app");
      if (metricRoot) {
        metricRoot.dataset.captureDrawCalls = String(gl.info.render.calls);
        metricRoot.dataset.captureTriangles = String(gl.info.render.triangles);
      }
      uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    } finally {
      for (const object of hidden) object.visible = true;
      hidden.length = 0;
      gl.setRenderTarget(previousTarget);
      gl.setClearAlpha(previousAlpha);
      gl.clippingPlanes = previousClipping;
      gl.shadowMap.autoUpdate = previousShadowUpdate;
      scene.background = previousBackground;
      bed.current.visible = true;
      terrain.current.material.colorWrite = previousTerrainColorWrite;
      terrain.current.visible = previousTerrainVisibility;
      water.current.visible = true;
    }
  }, -0.5);
  return (
    <>
      <mesh ref={terrain} geometry={resources.terrainGeometry} renderOrder={-10} visible={false} receiveShadow>
        <meshStandardMaterial color="#73867d" roughness={1} />
      </mesh>
      <mesh ref={bed} rotation={[-Math.PI / 2, 0, 0]} position={[0, SEABED_Y, 0]}>
        <planeGeometry args={[500, 500]} />
        <shaderMaterial
          vertexShader={bedVertex}
          fragmentShader={seabedFrag}
          uniforms={resources.bedUniforms}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={water}
        geometry={resources.waterGeometry}
        position={[0, SEA_LEVEL, 0]}
        renderOrder={4}
        onBeforeRender={(_renderer, _scene, _camera, _geometry, material) => {
          const sunlight = sunRef?.current;
          const shadow = sunlight?.shadow;
          const uniforms = material.uniforms;
          const current = resourceRef.current;
          if (sunlight) {
            sunlight.updateWorldMatrix(true, false);
            sunlight.target.updateWorldMatrix(true, false);
            const lightPosition = sunlight.matrixWorld.elements;
            const targetPosition = sunlight.target.matrixWorld.elements;
            uniforms.uSunDirection.value.set(
              lightPosition[12] - targetPosition[12],
              lightPosition[13] - targetPosition[13],
              lightPosition[14] - targetPosition[14],
            ).normalize();
            uniforms.uSunRadiance.value.copy(sunlight.color).multiplyScalar(sunlight.intensity);
          }
          uniforms.uTime.value = current.uniforms.uTime.value;
          uniforms.uResolution.value.copy(current.uniforms.uResolution.value);
          uniforms.uInverseProjection.value.copy(current.uniforms.uInverseProjection.value);
          uniforms.uCameraWorld.value.copy(current.uniforms.uCameraWorld.value);
          uniforms.uUnderwater.value = current.target.texture;
          uniforms.uDepth.value = current.target.depthTexture;
          uniforms.uSunReady.value = shadow?.map ? 1 : 0;
          if (shadow?.map) {
            uniforms.uSunDepth.value = shadow.map.depthTexture;
            uniforms.uSunMatrix.value.copy(shadow.matrix);
            uniforms.uSunTexel.value.set(1 / shadow.map.width, 1 / shadow.map.height);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSail?.(event.point);
        }}
      >
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={waterFrag}
          transparent
          depthWrite
          uniforms={resources.uniforms}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
