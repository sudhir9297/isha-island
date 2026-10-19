import { MAP_FRAME, ADIYOGI_ISLAND } from './AdiyogiTerrain.js';
import { NEEM_ISLAND } from './NeemTerrain.js';
export const MAP_DESTINATIONS = [
  { id: 'malai', name: 'Malai Vasal', x: 0, z: -12, span: 42, description: 'The island entrance. Follow the sandy shore through the mountain gate.' },
  { id: 'neem', name: 'Neem Point', x: NEEM_ISLAND.x, z: NEEM_ISLAND.z, span: 30, description: 'A small island with a spreading neem tree and a quiet bench overlooking the channel.' },
  { id: 'adiyogi', name: 'Adiyogi Island', x: ADIYOGI_ISLAND.x, z: ADIYOGI_ISLAND.z, span: 90, description: 'A broad sandy island across the channel. This destination is still taking shape.' },
];
export function mapDestination(id) { return MAP_DESTINATIONS.find(d => d.id === id) ?? MAP_FRAME; }
export function createMapDestination() { return { ...MAP_FRAME, id: null, from: { ...MAP_FRAME }, elapsed: 1.6 }; }
export function stepMapDestination(state, id, delta, reducedMotion = false) {
  if (state.id !== id) {
    state.from = { x: state.x, z: state.z, span: state.span };
    state.id = id; state.elapsed = 0;
  }
  const goal = mapDestination(id);
  state.elapsed = reducedMotion ? 1.6 : Math.min(1.6, state.elapsed + Math.max(0, Math.min(.1, delta)));
  const t = state.elapsed / 1.6, eased = t*t*t*(t*(t*6-15)+10);
  state.x = state.from.x + (goal.x-state.from.x)*eased;
  state.z = state.from.z + (goal.z-state.from.z)*eased;
  state.span = Math.exp(Math.log(state.from.span)*(1-eased)+Math.log(goal.span)*eased);
  return state;
}
