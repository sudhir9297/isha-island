import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { MAP_DESTINATIONS } from './MapDestinations.js';

// Buttons live inside the map dialog for keyboard focus; only their screen
// coordinates come from the scene camera. They never move the player.
export default function MapIslandMarkers({ markers, visible }) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    MAP_DESTINATIONS.forEach((destination, i) => {
      const button = markers.current[i];
      if (!button) return;
      point.set(destination.x, 0, destination.z).project(camera);
      button.style.visibility = visible && point.z >= -1 && point.z <= 1 ? 'visible' : 'hidden';
      const radius = destination.id === 'adiyogi' ? 30 : destination.id === 'neem' ? 8 : 12;
      button.style.width = `${Math.max(44, radius * 2 * camera.zoom)}px`;
      button.style.height = `${Math.max(44, radius * 1.5 * camera.zoom)}px`;
      button.style.left = `${(point.x*.5+.5)*size.width}px`;
      button.style.top = `${(-point.y*.5+.5)*size.height}px`;
    });
  }, .6);
  return null;
}
