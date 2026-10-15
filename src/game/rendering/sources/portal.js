// Source shaders for the build-time TSL generator.
export const vertexShader=`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;

export const fragmentShader=`
  varying vec2 vUv;
  uniform float uTime,uPulse,uGround,uOpacity;
  uniform vec3 uGold,uMist;
  float hash21(vec2 p){
    p=fract(p*vec2(123.34,456.21));
    p+=dot(p,p+45.32);
    return fract(p.x*p.y);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
      mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
  }
  float mist(vec2 p){
    float n=noise(p)*.57;
    p=mat2(.8,-.6,.6,.8)*p*2.03;
    n+=noise(p+7.3)*.28;
    n+=noise(p*2.07-4.8)*.15;
    return n;
  }
  void main(){
    vec2 uv=vUv;
    vec3 color;
    float alpha;
    if(uGround>0.5){
      vec2 ground=(uv-.5)*2.0;
      float drift=mist(ground*2.3+vec2(0.0,uTime*.12));
      float r=length(ground)+(.5-drift)*.12;
      float halo=exp(-r*r*3.5)*(1.0-smoothstep(.55,1.0,r));
      // A feathered, irregular light spill, with no ring or rectangular edge.
      alpha=halo*(.11+drift*.10)*(1.0+uPulse*.35);
      color=mix(uMist,uGold,.18+drift*.12);
    }else{
      // An opaque field fills the entire quad, including the corners.
      // Polar advection bends stretched noise into irregular inward currents;
      // it never uses a repeating sine-wave spiral or circular alpha mask.
      vec2 p=(uv-vec2(.50,.51))*vec2(2.0,2.18919);
      float r=length(p),a=atan(p.y,p.x);
      float travel=r+uTime*.105;
      float twist=a+log(r+.22)*2.7;
      vec2 orbit=vec2(cos(twist),sin(twist));
      vec2 field=orbit*(2.0+r*1.6)+vec2(travel*.8,-travel*.55);
      vec2 warp=vec2(mist(field+3.1),mist(field-5.4))-.5;
      float clouds=mist(field*1.8+warp*1.5);
      // Radially stretched noise gives thin ribbons with broken, uneven edges.
      vec2 ribbon=vec2(travel*16.0+warp.x*1.4,
        sin(twist)*2.1+cos(twist*2.0)*.6+warp.y*.5);
      float broad=noise(ribbon);
      float ridge=pow(max(0.0,1.0-abs(broad*2.0-1.0)),9.0);
      float detail=noise(ribbon*vec2(2.4,2.0)+vec2(7.0,uTime*.035));
      float lace=pow(max(0.0,1.0-abs(detail*2.0-1.0)),15.0);
      float breakup=smoothstep(.23,.76,mist(field*3.2+warp));
      float currents=ridge*(.3+breakup*.85)+lace*breakup*.48;
      float center=smoothstep(.025,.19,r);
      float softOuter=1.0-smoothstep(.85,1.55,r);
      // Corners retain saturated luminous mist rather than falling to black.
      vec3 deep=vec3(.012,.075,.19);
      vec3 blue=vec3(.025,.24,.49);
      vec3 cyan=vec3(.09,.58,.73);
      color=mix(deep,blue,clouds);
      color=mix(color,cyan,smoothstep(.42,.82,clouds)*.75);
      color+=mix(uMist,uGold,.58+breakup*.35)*currents*(.45+softOuter*.35)*center;
      color+=cyan*.12*pow(clouds,3.0);
      // A small soft focal point suggests depth without a large black disk.
      color*=mix(.26,1.0,center);
      color*=1.0+uPulse*.32*uOpacity;
      float edgeDistance=min(min(uv.x,1.0-uv.x),1.0-uv.y);
      float border=1.0-smoothstep(.035,.13,edgeDistance);
      // The quad starts below the floor: ground level is at UV y=0.0556.
      // Fade across the lowest visible 18%, offset by slowly rising noise.
      float edgeMist=mist(vec2(uv.x*7.0,uv.y*9.0-uTime*.24));
      float dissolve=smoothstep(.065,.235,uv.y+(edgeMist-.5)*.075);
      alpha=mix(uOpacity,max(uOpacity,.68),border)*dissolve;
      // Three restrained wisps converge as they rise into the portal. They
      // live on this same quad, so no particles or extra draw calls are needed.
      float h=max(0.0,uv.y-.0556);
      float wispX=(uv.x-.5)*(1.0+h*1.8)+sin(h*19.0-uTime*.7)*.016;
      float wisps=exp(-pow((wispX-.24)*95.0,2.0))
        +exp(-pow((wispX+.23)*90.0,2.0))
        +exp(-pow((wispX-.035)*110.0,2.0));
      float rising=noise(vec2(uv.x*16.0,h*20.0-uTime*.65));
      float wispMask=smoothstep(.005,.035,h)*(1.0-smoothstep(.13,.25,h));
      float wispAlpha=wisps*wispMask*rising*.13*uOpacity;
      color=mix(color,mix(uMist,uGold,.5),clamp(wispAlpha/(alpha+.001),0.0,1.0));
      alpha+=wispAlpha;
    }
    gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
    #include <colorspace_fragment>
  }
`;
