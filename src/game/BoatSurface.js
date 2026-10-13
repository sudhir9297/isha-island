export const surfaceVertex = `
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

export const surfaceFragment = `
uniform float uTime,uSpeed;
varying vec2 vUv;
float hullWidth(float z){
  if(z< -1.82)return mix(.025,.28,clamp((z+1.98)/.16,0.,1.));
  if(z< -1.55)return mix(.28,.52,(z+1.82)/.27);
  if(z< -1.18)return mix(.52,.72,(z+1.55)/.37);
  if(z< -.65)return mix(.72,.84,(z+1.18)/.53);
  if(z<0.)return mix(.84,.89,(z+.65)/.65);
  if(z<.7)return mix(.89,.87,z/.7);
  if(z<1.25)return mix(.87,.82,(z-.7)/.55);
  return mix(.82,.76,clamp((z-1.25)/.43,0.,1.));
}
void main(){
  // Coordinates match the contact plane and hull stations, with the bow at -z.
  vec2 p=vec2((vUv.x-.5)*3.1,(.5-vUv.y)*4.8);
  float width=hullWidth(p.y)*.9;
  float distanceToHull=max(abs(p.x)-width,max(-1.98-p.y,p.y-1.68));
  float contact=(1.-smoothstep(-.1,.16,distanceToHull))*.17;
  float drift=sin(p.y*8.7+p.x*5.3-uTime*.7)*.025
    +sin(p.y*17.1-p.x*9.2+uTime*.43)*.012;
  float edge=exp(-pow((distanceToHull-.045-drift)/.085,2.));
  float fragments=.48+.3*sin(p.y*7.3+p.x*4.7-uTime*.6)
    +.15*sin(p.y*15.9-p.x*8.1+uTime*.37);
  float bow=1.-smoothstep(-1.75,-.3,p.y);
  float wash=edge*fragments*(.035+uSpeed*.12)*(.55+bow*.45);
  float alpha=contact+wash;
  if(alpha<.003)discard;
  vec3 color=mix(vec3(.012,.045,.046),vec3(.51,.7,.62),wash/max(alpha,.001));
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}`;

export const churnFragment = `
uniform float uTime,uSpeed;
varying vec2 vUv;
float foamNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
  float b=fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453);
  float d=fract(sin(dot(i+vec2(1.,1.),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
void main(){
  vec2 p=vUv-.5;
  float outline=exp(-dot(p*vec2(2.8,2.3),p*vec2(2.8,2.3))*1.2);
  float broad=foamNoise(vUv*5.+vec2(uTime*.18,-uTime*.45));
  float fine=foamNoise(vUv*15.+vec2(-uTime*.27,uTime*.32));
  float density=smoothstep(.26,.76,broad*.7+fine*.3);
  float alpha=outline*(.25+density*.75)*smoothstep(.015,.55,uSpeed)*.44;
  if(alpha<.003)discard;
  gl_FragColor=vec4(vec3(.62,.78,.69),alpha);
  #include <colorspace_fragment>
}`;
