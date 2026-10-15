import {checkpointReveal} from './StoryMoments.js';
export default function CheckpointReveal({time, completed=false}) {
  const reveal=checkpointReveal(time,completed);
  if(!reveal.visible)return null;
  return <div className="checkpoint-reveal" role="status" aria-live="polite" style={{opacity:reveal.opacity}}>
    <div className="checkpoint-reveal__veil" />
    <div className="checkpoint-reveal__content" style={{transform:`scale(${reveal.scale})`,filter:`blur(${reveal.blur}px)`}}>
      <span className="checkpoint-reveal__eyebrow">{completed?'A MOMENT OF STILLNESS':'MALAI VASAL'}</span>
      <span className="checkpoint-reveal__line" aria-hidden="true" />
      <h1>{completed?'Nothing left to carry.':'Leave your burdens behind.'}</h1>
      <p>{completed?'Stay a while. The sea can wait.':'A lighter journey begins.'}</p>
      <span className="checkpoint-reveal__line" aria-hidden="true" />
    </div>
  </div>;
}
