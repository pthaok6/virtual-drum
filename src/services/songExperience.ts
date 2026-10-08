import type { BeatNote, RhythmChallenge, SongInfo, SongSection } from '../types';

export function songSections(durationSeconds: number, introMs = 0): SongSection[] {
  const end = Math.round(durationSeconds * 1000);
  const start = Math.min(introMs, end - 1000);
  const span = end - start;
  const labels = ['Opening', 'Main groove', 'Build-up', 'Finale'];
  const intensity: SongSection['intensity'][] = ['low', 'medium', 'high', 'medium'];
  return labels.map((label, index) => ({ id: 'section-' + index, label, startMs: Math.round(start + span * index / 4), endMs: Math.round(start + span * (index + 1) / 4), intensity: intensity[index] }));
}

export function prepareSong(challenge: RhythmChallenge, metadata: Omit<SongInfo, 'sections' | 'charts'>): RhythmChallenge {
  const sections = songSections(challenge.durationSeconds, challenge.music?.introMs ?? 0);
  const clean = (notes: BeatNote[]): BeatNote[] => notes.map(note => ({ ...note, hit: false, hitRating: undefined }));
  const base = clean(challenge.notes);
  let easy = base.filter(note => note.drum === 'kick' || note.drum === 'snare');
  if (!easy.length) easy = base.filter((_, index) => index % 2 === 0);
  const medium = base;
  const hard = [...base];
  const halfStep = 15000 / challenge.bpm;
  base.forEach((note, index) => {
    const section = sections.find(entry => note.timeMs >= entry.startMs && note.timeMs < entry.endMs);
    if (section?.intensity === 'high' && index % 4 === 3 && note.timeMs + halfStep < challenge.durationSeconds * 1000 - 200) {
      hard.push({ id: challenge.id + '-fill-' + index, drum: index % 8 === 3 ? 'tom' : 'crash', timeMs: Math.round(note.timeMs + halfStep) });
    }
  });
  hard.sort((a, b) => a.timeMs - b.timeMs);
  return { ...challenge, song: { ...metadata, sections, charts: { Easy: easy, Medium: medium, Hard: hard } } };
}
export function chooseSongDifficulty(challenge: RhythmChallenge, difficulty: RhythmChallenge['difficulty']): RhythmChallenge {
  return { ...challenge, difficulty, notes: (challenge.song?.charts[difficulty] ?? challenge.notes).map(note => ({ ...note, hit: false, hitRating: undefined })) };
}
export function formatSongTime(seconds: number): string {
  return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}

// Frontend fixture only: no rhythm inference is performed on uploaded audio.
export function demoAnalysis(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 3 || durationSeconds > 600) throw new Error('Choose a song between 3 seconds and 10 minutes long.');
  return { bpm: 100, startSeconds: Math.min(1.8, durationSeconds - 1.1), sections: songSections(durationSeconds, Math.min(1.8, durationSeconds - 1.1) * 1000) };
}
