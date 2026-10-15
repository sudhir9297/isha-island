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
    <section className="discovery-card" role="dialog" aria-modal="true" aria-labelledby="discovery-title" aria-describedby="discovery-text">
      <h2 id="discovery-title">{discovery.title}</h2>
      <p className="discovery-quote" id="discovery-text">{discovery.text}</p>
      <p className="discovery-quote">{discovery.detail}</p>
      <button ref={close} onClick={onClose}>Keep exploring</button>
    </section>
  </div>;
}
