// Fixed storage: no per-frame sorting or growing arrays. Summarize once per second.
export function createPerformanceWindow(capacity=600) {
  return {values:new Float64Array(capacity),count:0,cursor:0};
}
export function recordFrame(window,seconds) {
  if(!Number.isFinite(seconds)||seconds<=0)return;
  window.values[window.cursor]=seconds*1000;
  window.cursor=(window.cursor+1)%window.values.length;
  window.count=Math.min(window.count+1,window.values.length);
}
export function summarizeFrames(window) {
  if(!window.count)return null;
  const values=Array.from(window.values.subarray(0,window.count)).sort((a,b)=>a-b);
  const total=values.reduce((sum,value)=>sum+value,0);
  return {samples:values.length,seconds:total/1000,meanMs:total/values.length,p95Ms:values[Math.ceil(values.length*.95)-1],maxMs:values.at(-1),over33Ms:values.filter(value=>value>1000/30).length};
}
