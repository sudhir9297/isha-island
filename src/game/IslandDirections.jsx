import { collectIslandBounds, createIslandVisibilityCheck } from './IslandVisibility.js';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { SAILING_ISLANDS, layoutIslandDirections } from './IslandDirections.js';

export function IslandDirectionTracking({ element, boatState, enabled }) {
  const point = useRef(new Vector3());
  const islandBounds = useRef(null);
  const islandVisible = useRef(createIslandVisibilityCheck());
  useFrame(({ camera, size, scene }) => {
    const root = element.current;
    if (!root || !enabled) return;
    islandBounds.current ??= collectIslandBounds(scene);
    const visibleIsland = islandVisible.current(camera, islandBounds.current);
    root.style.setProperty('visibility', visibleIsland ? 'hidden' : 'visible');
    root.setAttribute('aria-hidden', String(visibleIsland));
    if (visibleIsland) return;
    const boat = boatState.current.position;
    const project = (x, z) => {
      point.current.set(x, 0, z).project(camera);
      return { x: (point.current.x + 1) * size.width / 2, y: (1 - point.current.y) * size.height / 2 };
    };
    const origin = project(boat.x, boat.z);
    const targets = SAILING_ISLANDS.map(island => ({ ...island, ...project(island.x, island.z), distance: Math.hypot(island.x - boat.x, island.z - boat.z) }));
    const layout = layoutIslandDirections(origin, targets, size.width, size.height);
    for (const [index, island] of SAILING_ISLANDS.entries()) {
      const marker = root.children[index];
      const position = layout.find(item => item.id === island.id);
      marker.toggleAttribute('hidden', !position);
      if (!position) continue;
      marker.style.setProperty('transform', `translate3d(${position.x}px, ${position.y}px, 0)`);
      marker.querySelector('svg').style.setProperty('transform', `rotate(${position.angle}deg)`);
    }
  }, .7);
  return null;
}

export default function IslandDirections({ element, visible }) {
  return <div ref={element} className="island-directions" hidden={!visible} aria-label="Directions to islands">
    {SAILING_ISLANDS.map(island => <div key={island.id} className="island-direction" role="img" aria-label={`Direction to ${island.name}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 20 12 16 4 20Z" /></svg>
    </div>)}
  </div>;
}
