import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {auditGlb} from './lib/glb-audit.mjs';
const root=new URL('../',import.meta.url);
const contracts=JSON.parse(await readFile(new URL('scripts/asset-budgets.json',root),'utf8'));
const report={generatedAt:new Date().toISOString(),assets:[]};
let failed=false;
for(const [file,contract] of Object.entries(contracts)){
  try{
    const bytes=await readFile(new URL(`public/models/${file}`,root));
    const stats=auditGlb(bytes),errors=[];
    for(const key of ['bytes','triangles','primitiveCount','materialCount'])if(stats[key]>contract.maximum[key])errors.push(`${key}: ${stats[key]} exceeds ${contract.maximum[key]}`);
    for(const node of contract.nodes??[])if(!stats.nodes.includes(node))errors.push(`Missing node: ${node}`);
    for(const clip of contract.animations??[])if(!stats.animations.includes(clip))errors.push(`Missing animation: ${clip}`);
    report.assets.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),...stats,errors});
    console.log(`${errors.length?'FAIL':'PASS'} ${file}: ${(stats.bytes/1e6).toFixed(2)} MB, ${stats.triangles.toLocaleString()} triangles, ${stats.primitiveCount} primitives`);
    for(const error of errors)console.error(`  ${error}`);
    failed ||= errors.length>0;
  }catch(error){failed=true;report.assets.push({file,errors:[error.message]});console.error(`${file}: ${error.message}`);}
}
const destination=new URL('reports/assets.json',root);await mkdir(new URL('reports/',root),{recursive:true});await writeFile(destination,JSON.stringify(report,null,2)+'\n');
console.log(`Report: ${fileURLToPath(destination)}`);
if(failed)process.exitCode=1;
