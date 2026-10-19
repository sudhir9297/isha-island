// The circular opening and zoom are visual only; the boat stays in place.
export function createStartupSequence({ resume = false } = {}) {
  return { phase: 'loading', time: 0, radius: 0, zoom: 1, offset: 0, fade: 0,
    resume, startRequested: false, skipRequested: false };
}
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t=clamp(value); return t*t*(3-2*t); };
export function stepStartupSequence(state, delta, ready, reducedMotion = false) {
  if (!ready || state.phase === 'complete') return;
  const quiet = reducedMotion || state.resume;
  if (state.phase === 'loading') { state.phase='arriving'; state.time=0; }
  state.time += Math.max(0,Math.min(delta,1/30));
  if (state.phase === 'arriving') {
    const t=state.skipRequested ? 1 : smooth(state.time/(quiet ? .2 : 1.6));
    state.radius=quiet?4.4:4.4*t;
    state.zoom=quiet?1:1+.5*t;
    if(t===1){state.phase='waiting';state.time=0;}
  }
  if(state.phase==='waiting' && state.startRequested){state.phase='revealing';state.time=0;}
  if(state.phase==='revealing'){
    const t=clamp(state.time/(quiet || state.skipRequested ? .25 : 2.2));
    const anticipation=Math.sin(Math.min(t/.22,1)*Math.PI)*.45;
    state.radius=quiet?4.4:4.4-anticipation+240*t**3;
    state.zoom=quiet?1:1.5-.5*smooth(t);
    state.fade=quiet?t:smooth((t-.72)/.28);
    if(t===1){state.phase='complete';state.radius=100000;state.zoom=1;state.fade=1;}
  }
}
