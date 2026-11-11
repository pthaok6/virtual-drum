import type { BeatNote, DrumType, GameResult, HitRating, RhythmChallenge } from '../types';

export interface TimingWindows {
  perfectMs: number;
  goodMs: number;
}

// Windows are in real milliseconds; chart time is scaled by the playback rate.
export const TIMING_WINDOWS: Record<RhythmChallenge['difficulty'], Readonly<TimingWindows>> = {
  Easy: { perfectMs: 80, goodMs: 250 },
  Medium: { perfectMs: 75, goodMs: 180 },
  Hard: { perfectMs: 60, goodMs: 150 },
};
export const HIT_WINDOW_MS = TIMING_WINDOWS.Medium.goodMs;

export function getTimingWindows(difficulty: RhythmChallenge['difficulty'] = 'Medium', playbackRate = 1): TimingWindows {
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const windows = TIMING_WINDOWS[difficulty];
  return { perfectMs: windows.perfectMs * rate, goodMs: windows.goodMs * rate };
}

export interface SongState {
  notes: BeatNote[];
  timing: TimingWindows;
  score: number; combo: number; maxCombo: number;
  perfectHits: number; goodHits: number; misses: number;
  replayEvents: NonNullable<GameResult['replayEvents']>;
}
export function createSongState(notes: BeatNote[], options: { difficulty?: RhythmChallenge['difficulty']; playbackRate?: number } = {}): SongState {
  return { notes: notes.map(note => ({ ...note, hit: false, hitRating: undefined })), timing: getTimingWindows(options.difficulty, options.playbackRate), score: 0, combo: 0, maxCombo: 0, perfectHits: 0, goodHits: 0, misses: 0, replayEvents: [] };
}
export function expireSongNotes(state: SongState, timeMs: number): SongState {
  const expired = state.notes.filter(note => !note.hit && note.timeMs < timeMs - state.timing.goodMs);
  if (!expired.length) return state;
  const ids = new Set(expired.map(note => note.id));
  return { ...state, combo: 0, misses: state.misses + expired.length, notes: state.notes.map(note => ids.has(note.id) ? { ...note, hit: true, hitRating: 'miss' } : note) };
}
export function hitSongNote(state: SongState, drum: DrumType, timeMs: number): { state: SongState; rating: HitRating } {
  const current = expireSongNotes(state, timeMs);
  const target = current.notes.filter(note => !note.hit && note.drum === drum && Math.abs(note.timeMs - timeMs) <= current.timing.goodMs)
    .sort((a, b) => Math.abs(a.timeMs - timeMs) - Math.abs(b.timeMs - timeMs))[0];
  const rating: HitRating = !target ? 'miss' : Math.abs(target.timeMs - timeMs) <= current.timing.perfectMs ? 'perfect' : 'good';
  const combo = target ? current.combo + 1 : 0;
  return { rating, state: {
    ...current, combo, maxCombo: Math.max(current.maxCombo, combo), score: current.score + (rating === 'perfect' ? 300 : rating === 'good' ? 200 : 0),
    perfectHits: current.perfectHits + Number(rating === 'perfect'), goodHits: current.goodHits + Number(rating === 'good'), misses: current.misses + Number(!target),
    notes: target ? current.notes.map(note => note.id === target.id ? { ...note, hit: true, hitRating: rating } : note) : current.notes,
    replayEvents: [...current.replayEvents, { drum, rating, timeMs: Math.max(0, timeMs) }],
  }};
}
export function songAccuracy(state: SongState): number {
  const total = state.perfectHits + state.goodHits + state.misses;
  return total ? Math.round((state.perfectHits + state.goodHits * 0.65) / total * 100) : 0;
}

export function songResult(challenge: RhythmChallenge, state: SongState): GameResult {
  const final = expireSongNotes(state, Infinity);
  const accuracy = songAccuracy(final);
  const rank: GameResult['rank'] = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D';
  const sectionResults = challenge.song?.sections.map(section => {
    const notes = final.notes.filter(note => note.timeMs >= section.startMs && note.timeMs < section.endMs);
    const hits = notes.filter(note => note.hitRating !== 'miss').length;
    const weighted = notes.reduce((sum, note) => sum + (note.hitRating === 'perfect' ? 1 : note.hitRating === 'good' ? 0.65 : 0), 0);
    const wrongHits = final.replayEvents.filter(event => event.rating === 'miss' && event.timeMs >= section.startMs && event.timeMs < section.endMs).length;
    return { label: section.label, hits, misses: notes.length - hits + wrongHits, accuracy: notes.length + wrongHits ? Math.round(weighted / (notes.length + wrongHits) * 100) : 0 };
  });
  return { challenge, sectionResults, score: final.score, maxScore: challenge.notes.length * 300, accuracy, maxCombo: final.maxCombo, perfectHits: final.perfectHits, goodHits: final.goodHits, misses: final.misses, stars: accuracy >= 85 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0, rank, replayEvents: final.replayEvents };
}
