export const COLLECTION_KEY = 'port.keepsakes.v1';
export const KEEPSAKES = [
  { id: 'shell', name: 'Peach shell', island: 'Malai Vasal', memory: 'A little crab uncovered this shell beneath the sand.', hint: 'Follow the crab along the shore.', color: '#efa88e' },
  { id: 'leaf', name: 'Neem leaf', island: 'Neem Point', memory: 'A fallen leaf from a quiet patch of shade beside the tree.', hint: 'Look beneath the spreading tree.', color: '#b6ce72', x: 63, z: -46 },
  { id: 'stone', name: 'Sea stone', island: 'Adiyogi Island', memory: 'A smooth stone from the southern shore, shaped by the water.', hint: 'Explore the southern shore.', color: '#a6c9cf', x: 130, z: -69 },
];
export function cleanCollection(value) {
  return Array.isArray(value) ? KEEPSAKES.filter(item => value.includes(item.id)).map(item => item.id) : [];
}
export function readCollection(storage) {
  let items = [];
  try { items = cleanCollection(JSON.parse(storage.getItem(COLLECTION_KEY) || '[]')); } catch {}
  try {
    const old = JSON.parse(storage.getItem('port.journey.v1') || 'null');
    if (old?.journey?.shellFound) items = collectItem(items, 'shell');
  } catch {}
  return cleanCollection(items);
}
export function collectItem(items, id) {
  return KEEPSAKES.some(item => item.id === id) && !items.includes(id) ? [...items, id] : items;
}
