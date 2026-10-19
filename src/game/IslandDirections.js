import { SHORE } from './WorldConfig.js';
import { NEEM_ISLAND } from './NeemTerrain.js';
import { ADIYOGI_ISLAND } from './AdiyogiTerrain.js';

export const SAILING_ISLANDS = [
  { id: 'malai', name: 'Malai Vasal', ...SHORE },
  { id: 'neem', name: 'Neem Point', ...NEEM_ISLAND },
  { id: 'adiyogi', name: 'Adiyogi', ...ADIYOGI_ISLAND },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Keep labels apart without changing where their arrows actually point.
// Screen-space layout also keeps the ring a readable size at any camera zoom.
export function layoutIslandDirections(origin, targets, width, height) {
  const compact = width < 600;
  const radius = compact ? 88 : 112;
  const boxWidth = compact ? 92 : 104, boxHeight = 46;
  const placed = [];
  for (const target of targets) {
    const dx = target.x - origin.x, dy = target.y - origin.y;
    if (Math.hypot(dx, dy) < 1) continue;
    const bearing = Math.atan2(dy, dx);
    let best = null;
    for (const offset of [0, .45, -.45, .9, -.9, 1.35, -1.35, 1.8, -1.8]) {
      const x = clamp(origin.x + Math.cos(bearing + offset) * radius, boxWidth / 2 + 8, width - boxWidth / 2 - 8);
      const y = clamp(origin.y + Math.sin(bearing + offset) * radius, boxHeight / 2 + 64, height - boxHeight / 2 - 100);
      const overlap = placed.reduce((sum, other) => sum + Math.max(0, boxWidth + 8 - Math.abs(x - other.x)) * Math.max(0, boxHeight + 8 - Math.abs(y - other.y)), 0);
      const score = overlap + Math.abs(offset);
      if (!best || score < best.score) best = { ...target, x, y, score, angle: Math.atan2(target.y - y, target.x - x) * 180 / Math.PI + 90 };
      if (overlap === 0) break;
    }
    placed.push(best);
  }
  return placed;
}
