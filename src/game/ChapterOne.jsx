import { journeyObjective } from './MessageFlow.js';

export function ChapterOneHUD({ status }) {
  const step = status.chapterStep;
  if (!step || (status.released && status.releaseTime < 8)) return null;
  return <aside className="chapter-one-hud" aria-label="Chapter one objective" aria-live="polite">
    <svg className="quest-mark" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 2 29 19 16 36 3 19Z" /><path d="m16 11 6 8-6 8-6-8Z" /><path d="M16 36v4" /></svg>
    <div><span className="quest-chapter">01 / THE ARRIVAL</span><p>{journeyObjective(status)}</p></div>
  </aside>;
}
