export const CHAPTER_SAVE_VERSION = 2;
export const CHAPTER_STEPS = ['arrive', 'gate', 'complete'];
export const CHAPTER_OBJECTIVES = {
  arrive: 'Row to Malai Vasal and step ashore',
  gate: 'Walk through Malai Vasal',
  complete: 'Motorboat unlocked · Return to your boat when you are ready',
};
export function createChapterOne() { return { version: CHAPTER_SAVE_VERSION, step: 'arrive' }; }
export function restoreChapterOne(value) {
  if (value?.version === 1 && ['arrive','welcome','stow','collect','deliver','tend','return','complete'].includes(value.step)) return createChapterOne();
  if (value?.version !== CHAPTER_SAVE_VERSION || !CHAPTER_STEPS.includes(value.step)) return null;
  return { version: CHAPTER_SAVE_VERSION, step: value.step };
}
export function stepChapterOne(journey, boat) {
  const chapter = journey.chapter;
  if (!chapter) return;
  if (chapter.step === 'arrive' && journey.mode === 'walking') chapter.step = 'gate';
  if (chapter.step !== 'complete' && journey.released) {
    chapter.step = 'complete';
    boat.boatId = 'skiff';
    boat.speed = 0;
    boat.velocity = undefined;
    boat.destination = null;
    boat.openingVoyage = false;
  }
}
