export function startCharacterAction(s,kind,target,item=null) {
  s.action={kind,item,time:0,duration:kind==='pickup'?1.1:1,target};
  s.velocityX=s.velocityZ=0;s.running=false;
  if(target)s.heading=Math.atan2(s.position.x-target.x,s.position.z-target.z);
}
export function advanceCharacterAction(s,dt) {
  if(!s.action)return;
  s.action.time+=dt;
  if(s.action.time>=s.action.duration)s.action=null;
}
export function characterActionPose(action) {
  if(!action)return null;
  const t=Math.max(0,Math.min(1,action.time/action.duration));
  const blend=Math.sin(Math.PI*t)**2;
  if(action.kind==='pickup')return {drop:.28*blend,bend:.5*blend,arm:-1.2*blend,elbow:.4*blend,twist:0,weight:blend};
  if(action.kind==='bell')return {drop:0,bend:.08*blend,arm:-(1.7-.55*t)*blend,elbow:.6*blend,twist:-.12*blend,weight:blend};
  return {drop:.04*blend,bend:.12*blend,arm:(.8-2.2*Math.max(0,Math.min(1,(t-.2)/.3)))*blend,elbow:.4*blend,twist:Math.sin(t*Math.PI*2)*.25*blend,weight:blend};
}
