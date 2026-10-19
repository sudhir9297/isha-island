import { useEffect } from 'react';
import { useProgress } from '@react-three/drei';

export default function StartupOverlay({ phase, error, onStart, onSkip }) {
  const progress = useProgress(state => state.progress);
  useEffect(() => {
    if (phase !== 'waiting') return;
    const key = event => {
      if (event.repeat || !['Enter', 'Space', 'KeyW', 'ArrowUp'].includes(event.code)) return;
      event.preventDefault(); onStart();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, onStart]);
  if (phase === 'complete' && !error) return null;
  return <div className={`startup-intro startup-${phase}${error ? ' startup-failed' : ''}`}>
    <span className="startup-wordmark">port<svg viewBox="0 0 44 12" aria-hidden="true"><path d="M1 7Q11-2 22 7T43 7" /></svg></span>
    {error ? <div className="startup-message" role="alert"><h1>The sea is taking a moment</h1><p>{error}</p><button className="startup-launch" onClick={() => location.reload()}>Try again <span aria-hidden="true">↻</span></button></div> : <>
      {(phase === 'arriving' || phase === 'revealing') && <button className="startup-skip" onClick={onSkip}>Skip animation</button>}
      {phase === 'loading' && <div className="startup-loading" role="status"><span className="startup-loader" aria-hidden="true" /><span>Preparing the sea</span><span className="startup-progress" aria-hidden="true"><i style={{ width: `${Math.min(99, Math.floor(progress))}%` }} /></span><small>{Math.min(99, Math.floor(progress))}%</small></div>}
      <div className="startup-invitation" aria-hidden={phase !== 'waiting'}>
        <span className="startup-chapter">01 / THE ARRIVAL</span>
        <button className="startup-launch" disabled={phase !== 'waiting'} onClick={onStart}>
          <svg className="startup-launch-mark" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" /><path d="m19 35 17-17m-13 0h13v13" /><path className="startup-launch-wave" d="M14 42q7-5 14 0t14 0" /></svg>
          <span>Set sail</span>
        </button>
        <p>A little boat. A world to discover.</p>
        <small className="startup-key-hint"><kbd>Enter</kbd> to begin</small>
      </div>
    </>}
  </div>;
}
