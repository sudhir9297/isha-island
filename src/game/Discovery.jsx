import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { PLACES } from "./Places";

export default function Discovery({ boatState, onDiscover, found, paused }) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (paused) return;
    elapsed.current += delta;
    if (elapsed.current < 0.35) return;
    elapsed.current = 0;
    const p = boatState.current.position;
    for (const place of PLACES) {
      if (
        !found.includes(place.id) &&
        Math.hypot(p.x - place.position[0], p.z - place.position[2]) < 3.5
      ) {
        onDiscover(place.id);
        break;
      }
    }
  });
  return null;
}
