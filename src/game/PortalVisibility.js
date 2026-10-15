export function createPortalVisibility(){return {opacity:1,hold:0,resetId:null};}
export function stepPortalVisibility(state,journey,portalZ,delta,paused=false){
  if(state.resetId!==journey.resetId){state.opacity=1;state.hold=0;state.resetId=journey.resetId;}
  if(paused)return state.opacity;
  const dt=Math.min(.05,Math.max(0,delta));
  const near=journey.mode!=='aboard'&&Math.abs(journey.position.x)<1.7&&Math.abs(journey.position.z-portalZ)<1.4;
  const relief=journey.released&&journey.releaseTime<3;
  if(near||relief)state.hold=3;
  else state.hold=Math.max(0,state.hold-dt);
  const target=state.hold>0?.18:1;
  const step=dt*.82/(target<state.opacity?.4:.8);
  state.opacity+=Math.sign(target-state.opacity)*Math.min(Math.abs(target-state.opacity),step);
  return state.opacity;
}
