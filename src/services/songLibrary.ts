import { chooseSongDifficulty, prepareSong } from './songExperience';
import type { DrumType, RhythmChallenge } from '../types';

export interface SavedSong {
  id: string; title: string; bpm: number; durationSeconds: number; startSeconds: number;
  difficulty: RhythmChallenge['difficulty']; file: Blob; demoAnalysis?: boolean;
}
const PATTERNS: Record<RhythmChallenge['difficulty'], DrumType[]> = {
  Easy: ['kick', 'snare', 'kick', 'snare'],
  Medium: ['kick', 'hihat', 'snare', 'hihat', 'kick', 'hihat', 'snare', 'hihat'],
  Hard: ['crash', 'kick', 'snare', 'hihat', 'tom', 'kick', 'snare', 'hihat'],
};

export function buildCustomChallenge(song: Omit<SavedSong, 'file'>, source: string): RhythmChallenge {
  if (!song.title.trim() || song.title.length > 80) throw new Error('Enter a song title with 1–80 characters.');
  if (!Number.isFinite(song.bpm) || song.bpm < 40 || song.bpm > 240) throw new Error('BPM must be between 40 and 240.');
  if (!Number.isFinite(song.durationSeconds) || song.durationSeconds < 3 || song.durationSeconds > 600) throw new Error('Choose a song between 3 seconds and 10 minutes long.');
  if (!Number.isFinite(song.startSeconds) || song.startSeconds < 0 || song.startSeconds >= song.durationSeconds - 1) throw new Error('The first beat must be at least one second before the song ends.');
  const chartDifficulty = song.demoAnalysis ? 'Medium' : song.difficulty;
  const pattern = PATTERNS[chartDifficulty];
  if (!pattern) throw new Error('Choose a difficulty.');
  const stepMs = (chartDifficulty === 'Easy' ? 60000 : 30000) / song.bpm;
  const startMs = song.startSeconds * 1000;
  const count = Math.ceil(((song.durationSeconds - 0.2) * 1000 - startMs) / stepMs);
  const prepared = prepareSong({
    id: song.id, title: song.title.trim(), artist: 'Your music', difficulty: song.difficulty,
    bpm: song.bpm, durationSeconds: song.durationSeconds, description: 'An illustrative drum chart for your audio. Automatic analysis is not connected yet.',
    music: { src: source, introMs: startMs },
    notes: Array.from({ length: count }, (_, step) => ({ id: song.id + '-' + step, drum: pattern[step % pattern.length], timeMs: Math.round(startMs + step * stepMs) })),
  }, { genre: 'Your music', color: 'from-violet-500 via-fuchsia-800 to-zinc-950', source: 'upload', chartSource: 'demo' });
  return song.demoAnalysis ? chooseSongDifficulty(prepared, song.difficulty) : prepared;
}

export function musicSource(source: string, basePath = '/'): string {
  return source.startsWith('blob:') ? source : basePath + source;
}
export function readAudioDuration(file: File): Promise<number> {
  if (!file.size || file.size > 50 * 1024 * 1024) return Promise.reject(new Error('Choose an audio file smaller than 50 MB.'));
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) return Promise.reject(new Error('Choose a supported audio file.'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => { clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Could not read this audio file. Try another file.')); }, 15000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { const duration = audio.duration; cleanup(); if (Number.isFinite(duration)) resolve(duration); else reject(new Error('Could not read this audio file. Try another file.')); };
    audio.onerror = () => { cleanup(); reject(new Error('Could not read this audio file. Try another file.')); };
    audio.src = url;
  });
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('virtual-drum-songs', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('songs', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Song storage is unavailable.'));
  });
}
export async function loadSavedSongs(): Promise<SavedSong[]> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readonly');
    const request = tx.objectStore('songs').getAll();
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function saveSong(song: SavedSong): Promise<void> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.objectStore('songs').put(song);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
