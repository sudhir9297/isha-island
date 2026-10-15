import { useFrame } from '@react-three/fiber';

// Read the active camera after the camera rig/OrbitControls update. Updating
// one CSS variable avoids sending frame-by-frame camera data through React.
export function CompassBearing({ element }) {
  useFrame(({ camera }) => {
    if (!element.current) return;
    camera.updateMatrixWorld();
    const right = camera.matrixWorld.elements;
    const angle = Math.atan2(-right[2], right[0]) * 180 / Math.PI;
    element.current.style.setProperty('--compass-bearing', `${angle.toFixed(1)}deg`);
  });
  return null;
}

export default function Compass({ element }) {
  return <div ref={element} className="island-compass" role="img" aria-label="Compass. The red needle points north.">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" className="compass-rim" />
      <circle cx="50" cy="50" r="34" className="compass-inner" />
      <g className="compass-bearing">
        {[0,45,90,135,180,225,270,315].map(angle => <path key={angle} d="M50 19 V23" transform={`rotate(${angle} 50 50)`} className="compass-tick" />)}
        <path d="M50 28 L56 50 L50 47 L44 50 Z" fill="#ee8a72" />
        <path d="M50 72 L56 50 L50 53 L44 50 Z" fill="#dfdfc9" opacity="0.7" />
        {[['N',50,13],['E',88,52],['S',50,91],['W',12,52]].map(([label,x,y]) =>
          <text key={label} x={x} y={y} className={`compass-label ${label === 'N' ? 'compass-north' : ''}`}>{label}</text>)}
      </g>
      <circle cx="50" cy="50" r="2.5" fill="#fff0cc" />
    </svg>
  </div>;
}
