// Passive guidance is remembered independently of UI mounts and action prompts.
export function rememberHint(history, id) {
  if (history.includes(id)) return false;
  history.push(id);
  return true;
}
export function restoreHints(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id.length <= 200))].slice(0, 128) : [];
}
export function journeyObjective(s) {
  if (s.released) return s.completed ? 'Explore at your own pace' : 'Find a quiet place by the sea';
  if (s.mode === 'aboard') return 'Row to Malai Vasal and step ashore';
  if (!s.noteRead) return 'Read the letter at the landing';
  if (s.shellFound) return 'Walk through Malai Vasal';
  if (!s.crabInvited) return 'Meet the crab on the shore';
  if (!s.shellRevealed) return 'Follow your little guide';
  if (!s.shellFound) return 'Pick up the shell';
  return 'Walk through Malai Vasal';
}
