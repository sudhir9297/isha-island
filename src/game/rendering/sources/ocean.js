// Source shaders for the build-time TSL generator.
import { SEABED_GLSL } from '../../Seabed.js';
import { WATER_OPTICS_GLSL } from '../../WaterOptics.js';
export const vertex = `
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

export const bedVertex = `
varying vec3 vWorld;
void main(){
 vec4 world=modelMatrix*vec4(position,1.0);
 vWorld=world.xyz;
 gl_Position=projectionMatrix*viewMatrix*world;
}`;

export const shared = `
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

export const seabedFrag = `
uniform float uTime;uniform vec3 uDeep,uLagoon,uShallow,uSand,uMint,uAqua;
varying vec3 vWorld;
${shared}
void main(){
 vec2 p=vWorld.xz;float d=shore(p);
 vec3 c=floorColor(p,d);
 gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}`;

export const waterFrag = `
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
