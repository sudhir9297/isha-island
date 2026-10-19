import { useEffect, useRef } from 'react';
import { DISCOVERIES } from './Discoveries.js';
export default function DiscoveryCard({ id, onClose }) {
  const close = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const discovery = DISCOVERIES[id];
  return <div className="discovery-backdrop" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.code === 'KeyE') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
  }}>
    <section className="discovery-story" role="dialog" aria-modal="true" aria-labelledby="discovery-title" aria-describedby="discovery-text discovery-detail">
      <span className="discovery-kicker">{id === 'note' ? 'A letter at the landing · Malai Vasal' : `A small discovery · ${discovery.island ?? 'Malai Vasal'}`}</span>
      <span className="discovery-seal" aria-hidden="true">{id === 'note' ? '✉' : '✧'}</span>
      <h2 id="discovery-title">{discovery.title}</h2>
      <p className="discovery-quote" id="discovery-text">{discovery.text}</p>
      <div className="discovery-next"><span>{id === 'note' ? 'On the beach' : id === 'crab' ? 'Follow your guide' : 'In your satchel'}</span><p id="discovery-detail">{discovery.detail}</p></div>
      <button ref={close} onClick={onClose}>{id === 'note' ? 'Look for the crab' : id === 'crab' ? 'Lead the way' : 'Keep exploring'} <span aria-hidden="true">→</span></button>
    </section>
  </div>;
}
