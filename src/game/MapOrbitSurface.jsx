import { useRef } from 'react';
import { turnMapOrbit, resetMapOrbit } from './MapOrbit.js';

export default function MapOrbitSurface({ orbit }) {
  const drag = useRef(null);
  const finish = event => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.dataset.dragging = 'false';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="map-orbit-surface" role="group" aria-label="Drag left or right to rotate the island map" tabIndex={0}
    onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      drag.current = { id:event.pointerId, x:event.clientX };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = 'true';
    }}
    onPointerMove={event => {
      if (drag.current?.id !== event.pointerId) return;
      const delta = event.clientX - drag.current.x;
      drag.current.x = event.clientX;
      turnMapOrbit(orbit.current, -delta / Math.max(320,event.currentTarget.clientWidth) * Math.PI * 2);
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={event => {
      if (!['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
      event.preventDefault();
      if(event.key==='Home') resetMapOrbit(orbit.current);
      else turnMapOrbit(orbit.current,event.key==='ArrowLeft'?.2:-.2);
    }}/>;
}
