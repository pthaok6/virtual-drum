import { prepareSong } from '../services/songExperience';
import type { RhythmChallenge, DrumType } from '../types';

export const SONG_INTRO_MS = 1800;
export const SONGS = [
  { id: 'neon-drive', title: 'Neon Drive', bpm: 96, bars: 12, difficulty: 'Easy' as const, description: 'A melodic synth-pop song with a steady kick and snare backbeat.', roots: [48, 55, 57, 53], melody: [72, 76, 79, 76, 74, 71, 67, 71], pattern: ['kick', 'hihat', 'snare', 'hihat', 'kick', 'hihat', 'snare', 'hihat'] },
  { id: 'sunset-groove', title: 'Sunset Groove', bpm: 112, bars: 12, difficulty: 'Medium' as const, description: 'A warm funk song with a syncopated bassline and playful tom fills.', roots: [45, 50, 43, 48], melody: [69, 72, 76, 79, 76, 72, 74, 71], pattern: ['kick', 'hihat', 'snare', 'tom', 'kick', 'kick', 'snare', 'hihat'] },
  { id: 'midnight-rush', title: 'Midnight Rush', bpm: 132, bars: 16, difficulty: 'Hard' as const, description: 'An energetic electronic song with fast beats and crashing accents.', roots: [40, 48, 43, 50], melody: [76, 79, 83, 79, 74, 78, 81, 78], pattern: ['crash', 'kick', 'snare', 'hihat', 'tom', 'kick', 'snare', 'hihat'] },
];

export const SONG_CHALLENGES: RhythmChallenge[] = SONGS.map((song) => prepareSong({
  id: song.id, title: song.title, artist: 'Virtual Drum Originals', difficulty: song.difficulty,
  bpm: song.bpm, durationSeconds: (SONG_INTRO_MS / 1000) + song.bars * 4 * 60 / song.bpm + 1,
  description: song.description,
  music: { src: 'audio/' + song.id + '.wav', introMs: SONG_INTRO_MS },
  notes: Array.from({ length: song.bars * 8 }, (_, step) => ({
    id: song.id + '-' + step, drum: song.pattern[step % 8] as DrumType,
    timeMs: Math.round(SONG_INTRO_MS + step * 30000 / song.bpm),
  })),
}, { genre: song.id === 'neon-drive' ? 'Synth-pop' : song.id === 'sunset-groove' ? 'Funk' : 'Electronic', color: song.id === 'neon-drive' ? 'from-rose-500 via-fuchsia-700 to-indigo-950' : song.id === 'sunset-groove' ? 'from-amber-400 via-orange-700 to-rose-950' : 'from-cyan-400 via-blue-700 to-indigo-950', source: 'original', chartSource: 'prepared' }));
