// Reproducible, build-time GLSL -> TSL migration. No runtime evaluation.
import { readFile, writeFile } from 'node:fs/promises';
import Transpiler from 'three/addons/transpiler/Transpiler.js';
import GLSLDecoder from 'three/addons/transpiler/GLSLDecoder.js';
import TSLEncoder from 'three/addons/transpiler/TSLEncoder.js';
import { SEABED_GLSL } from '../src/game/Seabed.js';
import { WATER_OPTICS_GLSL } from '../src/game/WaterOptics.js';
import { surfaceFragment } from '../src/game/BoatSurface.js';
import { foamFragment } from '../src/game/BoatFoam.js';
const extract = (source, name) => {
 const match=source.match(new RegExp('const '+name+'\\s*=\\s*(?:/\\*[^]*?\\*/\\s*)?`([^]*?)`;'));
 if(!match)throw Error('Missing shader '+name);
 return match[1];
};
const ocean=await readFile('src/game/rendering/sources/ocean.js','utf8');
const expand=source=>source.replaceAll('${SEABED_GLSL}',SEABED_GLSL).replaceAll('${WATER_OPTICS_GLSL}',WATER_OPTICS_GLSL).replaceAll('${shared}',expandShared);
const expandShared=extract(ocean,'shared').replaceAll('${SEABED_GLSL}',SEABED_GLSL);
async function compile(name,source,inputs={}) {
 source=source.replace('if(d>=1.35)return uDeep*deepLight;', '').replace('return c*deepLight;', 'return d>=1.35 ? uDeep*deepLight : c*deepLight;');
 source=source.replace(/vec3 seabedSample\(vec2 p\)\{([^]*?)\n\}/, (_, body) => {
   body=body.replace('if(any(lessThan(grid,vec2(0.)))||any(greaterThanEqual(grid,uSeabedSize-1.)))return vec3(uSeabedGrid.w,0.,0.);', 'vec3 sampled=vec3(uSeabedGrid.w,0.,0.); if(all(greaterThanEqual(grid,vec2(0.)))&&all(lessThan(grid,uSeabedSize-1.))){');
   body=body.replace('if(f.x+f.y<=1.)return ', 'sampled = f.x+f.y<=1. ? ').replace(';\n return vec3(d+', ' : vec3(d+');
   return 'vec3 seabedSample(vec2 p){'+body+'} return sampled;\n}';
 });
 source=source.replace(/float seabedSiltWeight\(vec2 p\)\{([^]*?)\n\}/, (_, body) => {
   body=body.replace('if(any(lessThan(grid,vec2(0.)))||any(greaterThanEqual(grid,uSeabedSize-1.)))return 0.;', 'float sampled=0.; if(all(greaterThanEqual(grid,vec2(0.)))&&all(lessThan(grid,uSeabedSize-1.))){');
   body=body.replace('return f.x+f.y<=1.?', 'sampled = f.x+f.y<=1.?');
   return 'float seabedSiltWeight(vec2 p){'+body+'} return sampled;\n}';
 });
 source=source.replace(/uniform\s+(\w+)\s+([^;]+);/g, (_, type, names) => names.split(',').map(name => `uniform ${type} ${name.trim()};`).join('\n'));
 source=source.replace(/#include[^\n]*/g,'').replace(/varying\s+\w+\s+(\w+)\s*;/g,'')
 .replace(/void main\(\)\s*\{/, 'vec4 shade(){ vec4 result=vec4(0.);')
 .replaceAll('gl_FragColor','result').replace(/}\s*$/, 'return result;\n}')
 .replace('NeutralToneMapping(c)','c');
 const encoder=new TSLEncoder();encoder.reference=true;
 const emitExpression=encoder.emitExpression;
 encoder.emitExpression=function(node, output) {
   const numeric = node.isOperator && node.isNumericExpression;
   if (numeric) {
     const operation = { '+':'add', '-':'sub', '*':'mul', '/':'div', '%':'mod' }[node.type];
     if (!operation) throw Error(`Unsupported constant operator ${node.type}`);
     this.addImport(operation);
     return `${operation}(${this.emitExpression(node.left)}, ${this.emitExpression(node.right)})`;
   }
   return emitExpression.call(this,node,output);
 };
 // r186's emitter does not materialize mutable locals or comma chains reliably.
 // Explicit node variables preserve GLSL assignment and boolean semantics.
 encoder.emitVariables = function(node, isRoot = true) {
   this.addImport(node.type);
   const value = node.value ? `${node.type}(${this.emitExpression(node.value)})` : `property('${node.type}')`;
   if (!node.value) this.addImport('property');
   return `${isRoot ? 'const ' : ''}${node.name} = ${value}.toVar()` + (node.next ? ', ' + this.emitVariables(node.next, false) : '');
 };
 let code=new Transpiler(new GLSLDecoder(),encoder).parse(source);
 const inline = new Set(['shade','seabedSample','seabedHeight','seabedSiltWeight','floorColor','positionFromDepth','receiverFocusing','sunVisibility','islandBaseWind','islandWindPosition','islandWindNormal','beachWetness']);
 code=code.replace(/(export const (\w+) = [^]*?)(}, \{ [^\n]*return: [^\n]* \} \);)/g, (all, body, fn, end) => body + (inline.has(fn) ? '} );' : end))
 .replace(/reference\( 'value', 'vec3', uniforms\[ '(\w+)' \] \)/g, (_, name) => `reference('value', uniforms['${name}']?.value?.isColor ? 'color' : 'vec3', uniforms['${name}'])`)
 .replace(/reference\( 'value', 'texture', uniforms\[ '(\w+)' \] \)/g, (_, name) => `texture(uniforms['${name}']?.value)`)
 .replace(/- (\d*\.\d*)\.(sub|add|mul|div)\(/g, 'float(-$1).$2(');
 code=code.replace(/import \{ ([^}]+) \}/, (_, names) => `import { ${[...new Set(['texture','float', ...names.split(',').map(s=>s.trim())])].join(', ')} }`);
 const imports=code.match(/import[^;]+;/g)?.join('\n')??'';
 code=code.replace(/import[^;]+;/g,'').replaceAll('export const ','const ');
 const sharedFunctions=[];
 code=code.replace(/const \w+ = \/\*@__PURE__\*\/ Fn\([^]*?\n}(?:, \{ [^\n]+\})? \);/g, declaration => {
   if (/\n}, \{ [^\n]+\} \);$/.test(declaration)) { sharedFunctions.push(declaration); return ''; }
   return declaration;
 });
 const inputCode=Object.keys(inputs).map(key=>`const ${key} = inputs.${key};`).join('\n');
 await writeFile(`src/game/rendering/generated/${name}.js`, `// Generated by scripts/migrate-render-shaders.mjs. Edit the source shaders, then regenerate.\n/* eslint-disable no-unused-vars -- shared GLSL helpers are emitted before GPU dead-code elimination. */\n${imports}\n${sharedFunctions.join("\n")}\nexport function ${name}(uniforms, inputs = {}) {\n${inputCode}\n${code}\nreturn shade();\n}\n`);
}
await compile('glow',extract(await readFile('src/game/rendering/sources/glow.js','utf8'),'glowFragment'),{vUv:1});
await compile('portal',extract(await readFile('src/game/rendering/sources/portal.js','utf8'),'fragmentShader'),{vUv:1});
await compile('contact',surfaceFragment,{vUv:1});
await compile('foam',foamFragment,{vUv:1,vSeed:1,vFade:1});
await compile('seabed',expand(extract(ocean,'seabedFrag')),{vWorld:1});
let water=expand(extract(ocean,'waterFrag'));
// TSL render-target UVs use a top-left origin on both backends. Keep the
// original clip-space coordinates for inverse projection; flip only sampling.
water=water.replace(/texture2D\((uUnderwater|uDepth),(distorted|uv)\)/g, 'texture2D($1,vec2($2.x,1.-$2.y))');
// WebGPU uses 0..1 clip depth; the input converts sampled depth per backend.
water=water.replace('depth*2.-1.','depth*uClipDepthScale+uClipDepthBias')
 .replace('uniform float uTime;', 'uniform float uTime,uClipDepthScale,uClipDepthBias;');
// A backend-independent comparison node handles the sun depth map.
water=water.replace('uniform sampler2DShadow uSunDepth;','')
 .replace('texture(uSunDepth,vec3(q.xy+vec2(float(x),float(y))*uSunTexel*spread,q.z-.00025))','sampleSun(q.xy+vec2(float(x),float(y))*uSunTexel*spread,q.z-.00025)');
water=water.replace('if(uSunReady<.5)return 1.;', 'float visibility=1.; if(uSunReady>=.5){')
 .replace('if(q.x<0.||q.y<0.||q.x>1.||q.y>1.||q.z>1.)return 1.;','if(q.x>=0.&&q.y>=0.&&q.x<=1.&&q.y<=1.&&q.z<=1.){')
 .replace('return sum/9.;','visibility=sum/9.; } } return visibility;');
water=water.replace('for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){','for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){').replace('visibility=sum/9.;','} visibility=sum/9.;');
await compile('water',water,{vWorld:1,vClip:1,sampleSun:1});

await compile('waves',`${SEABED_GLSL}\n${WATER_OPTICS_GLSL}\nuniform float uTime;\nvoid main(){gl_FragColor=vec4(waterSurface(worldPosition.xz,uTime,seabedSample(worldPosition.xz)),1.);}`,{worldPosition:1});
const windSource=extract(await readFile('src/game/Wind.js','utf8'),'windFunctions');
for(const leaf of [false,true]) {
 const source=windSource.replace(/#ifdef ISLAND_LEAF_WIND([^]*?)#endif/,(_,body)=>leaf?body:'');
 for(const normal of [false,true]) {
  await compile(`${leaf?'leafWind':'wind'}${normal?'Normal':'Position'}`,source+`\nvoid main(){gl_FragColor=vec4(${normal?'islandWindNormal(position, normal)':'islandWindPosition(position)'},1.);}`,
   {modelMatrix:1,position:1,normal:1,...(leaf?{leafWindRoot:1,leafWindReach:1,leafWindAxis:1}:{})});
 }
}
await compile('beachWetness',`${SEABED_GLSL}\n${WATER_OPTICS_GLSL}
uniform float uBeachTime;
float beachWetness(float waterY){return 1.-smoothstep(.004,.032,beachWorld.y-waterY);}
void main(){
float wet=0.;
if(beachWorld.y<=.04){
vec3 bed=seabedSample(beachWorld.xz);
float now=-.08+waterSurface(beachWorld.xz,uBeachTime,bed).x;
float recent=-.08+waterSurface(beachWorld.xz,uBeachTime-1.2,bed).x;
float older=-.08+waterSurface(beachWorld.xz,uBeachTime-2.4,bed).x;
wet=max(beachWetness(now),max(.78*beachWetness(recent),.56*beachWetness(older)));
}
gl_FragColor=vec4(wet);
}`,{beachWorld:1});
const reef=await readFile('src/game/Reef.jsx','utf8');
const stoneFunctions=reef.match(/shader.fragmentShader = `varying vec3 reefStoneWorld;([^]*?)` \+ shader.fragmentShader/)[1].replaceAll('${SEABED_GLSL}',SEABED_GLSL);
const stoneBody=reef.match(/float stoneGrain=([^]*?)diffuseColor.rgb=mix\(mineral,sediment,contact\);/)[0];
await compile('stoneColor',stoneFunctions+'\nvoid main(){'+stoneBody.replace('diffuseColor.rgb=mix(mineral,sediment,contact);','gl_FragColor=vec4(mix(mineral,sediment,contact),1.);')+'}',{reefStoneWorld:1});

console.log('Generated 13 TSL shader factories.');
