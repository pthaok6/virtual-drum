import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SONG_CHALLENGES } from '../src/data/songs';
import { RECORDING_CHALLENGES } from '../src/data/recordings';
import { chooseSongDifficulty, demoAnalysis, prepareSong, simplifyEasyNotes, songSections } from '../src/services/songExperience';
import { buildCustomChallenge } from '../src/services/songLibrary';
import { createSongState, hitSongNote, songResult } from '../src/services/rhythm';
import type { BeatNote, RhythmChallenge } from '../src/types';

test('Easy removes rapid snare repetitions while preserving original on-beat hits', () => {
  const notes: BeatNote[] = Array.from({ length: 21 }, (_, index) => ({
    id: 'snare-' + index, drum: 'snare', timeMs: 1000 + index * 100,
  }));
  const snapshot = structuredClone(notes);
  const easy = simplifyEasyNotes(notes, 120, 1000);
  assert.deepEqual(easy.map(note => note.timeMs), [1000, 1500, 2000, 2500, 3000]);
  assert.deepEqual(notes, snapshot);
  assert.ok(easy.every(note => notes.includes(note)));
  assert.deepEqual(simplifyEasyNotes(easy, 120, 1000), easy);
});

test('Easy keeps a main hit instead of an earlier ghost and avoids rapid drum switches', () => {
  const notes: BeatNote[] = [
    { id: 'ghost', drum: 'snare', timeMs: 1380 },
    { id: 'nearby-kick', drum: 'kick', timeMs: 1420 },
    { id: 'backbeat', drum: 'snare', timeMs: 1500 },
    { id: 'kick', drum: 'kick', timeMs: 2000 },
    { id: 'next-backbeat', drum: 'snare', timeMs: 2500 },
    { id: 'hat', drum: 'hihat', timeMs: 2750 },
  ];
  assert.deepEqual(simplifyEasyNotes(notes, 120, 1000).map(note => note.id), ['backbeat', 'kick', 'next-backbeat']);
});

test('Easy spacing follows slow tempos and tolerates rounded beat times', () => {
  const slow: BeatNote[] = [0, 500, 1000, 1500, 2000].map((timeMs, index) => ({ id: 'slow-' + index, drum: 'snare', timeMs }));
  assert.deepEqual(simplifyEasyNotes(slow, 60).map(note => note.timeMs), [0, 1000, 2000]);
  const bpm = 117.5;
  const rounded: BeatNote[] = Array.from({ length: 8 }, (_, index) => ({ id: 'rounded-' + index, drum: 'snare', timeMs: Math.round(1800 + index * 60000 / bpm) }));
  assert.deepEqual(simplifyEasyNotes(rounded, bpm, 1800), rounded);
});

test('Easy remains playable for charts containing only other drums without repeated thinning', () => {
  const notes: BeatNote[] = [
    { id: 'hat-0', drum: 'hihat', timeMs: 0 },
    { id: 'hat-100', drum: 'hihat', timeMs: 100 },
    { id: 'hat-500', drum: 'hihat', timeMs: 500 },
    { id: 'tom-750', drum: 'tom', timeMs: 750 },
  ];
  const easy = simplifyEasyNotes(notes, 120);
  assert.deepEqual(easy.map(note => note.id), ['hat-0', 'hat-500', 'tom-750']);
  assert.deepEqual(simplifyEasyNotes(easy, 120), easy);
  assert.deepEqual(simplifyEasyNotes([], 120), []);
});

test('preparing and selecting Easy fixes legacy density without changing original or harder charts', () => {
  const notes: BeatNote[] = [
    { id: 'kick', drum: 'kick', timeMs: 1000 },
    { id: 'ghost', drum: 'snare', timeMs: 1380 },
    { id: 'snare', drum: 'snare', timeMs: 1500 },
    { id: 'hat', drum: 'hihat', timeMs: 1750 },
    { id: 'kick-2', drum: 'kick', timeMs: 2000 },
  ];
  const raw: RhythmChallenge = {
    id: 'dense-upload', title: 'Dense upload', artist: 'Test', difficulty: 'Easy', bpm: 120,
    durationSeconds: 6, description: '', music: { src: 'blob:test', introMs: 1000 }, notes,
  };
  const prepared = prepareSong(raw, { genre: 'Test', color: '', source: 'upload', chartSource: 'estimated' });
  assert.deepEqual(prepared.notes, notes);
  assert.deepEqual(chooseSongDifficulty(prepared, 'Medium').notes.map(({ id, drum, timeMs }) => ({ id, drum, timeMs })), notes);
  for (const note of notes) {
    assert.ok(chooseSongDifficulty(prepared, 'Hard').notes.some(entry => entry.id === note.id && entry.timeMs === note.timeMs));
  }
  const expected = ['kick', 'snare', 'kick-2'];
  assert.deepEqual(prepared.song!.charts.Easy.map(note => note.id), expected);
  const legacy = { ...prepared, song: { ...prepared.song!, charts: { ...prepared.song!.charts, Easy: notes } } };
  const selected = chooseSongDifficulty(legacy, 'Easy');
  assert.deepEqual(selected.notes.map(note => note.id), expected);
  assert.deepEqual(chooseSongDifficulty(selected, 'Easy').notes, selected.notes);
  assert.deepEqual(legacy.song.charts.Easy, notes);
});

test('difficulty charts preserve the recording while changing drum detail', () => {
  for (const song of [...SONG_CHALLENGES, ...RECORDING_CHALLENGES]) {
    const easy = chooseSongDifficulty(song, 'Easy');
    const medium = chooseSongDifficulty(song, 'Medium');
    const hard = chooseSongDifficulty(song, 'Hard');
    assert.equal(easy.music?.src, hard.music?.src);
    assert.ok(easy.notes.length < medium.notes.length);
    assert.ok(medium.notes.length <= hard.notes.length);
    assert.ok(easy.notes.every(note => note.drum === 'kick' || note.drum === 'snare'));
    assert.ok(hard.notes.every((note, index, notes) => !index || note.timeMs >= notes[index - 1].timeMs));
    assert.ok(hard.notes.every(note => note.timeMs >= 0 && note.timeMs < song.durationSeconds * 1000));
    hard.notes[0].hit = true;
    assert.equal(chooseSongDifficulty(song, 'Hard').notes[0].hit, false);
  }
});
test('upload analysis is an explicit fixture and keeps the chosen difficulty', () => {
  const fixture = demoAnalysis(30);
  assert.equal(fixture.bpm, 100);
  const song = buildCustomChallenge({ id: 'mock', title: 'My music', bpm: fixture.bpm, startSeconds: fixture.startSeconds, durationSeconds: 30, difficulty: 'Hard', demoAnalysis: true }, 'blob:test');
  assert.equal(song.song?.chartSource, 'demo');
  assert.equal(song.song?.source, 'upload');
  assert.equal(song.difficulty, 'Hard');
  assert.deepEqual(song.notes, chooseSongDifficulty(song, 'Hard').notes);
  assert.ok(song.song!.charts.Easy.length < song.song!.charts.Medium.length);
  assert.throws(() => demoAnalysis(Infinity));
});
test('sections are contiguous, ordered, and remain within the audio duration', () => {
  const sections = songSections(30, 1800);
  assert.equal(sections[0].startMs, 1800);
  assert.equal(sections.at(-1)?.endMs, 30000);
  sections.forEach((section, index) => {
    assert.ok(section.endMs > section.startMs);
    if (index) assert.equal(section.startMs, sections[index - 1].endMs);
  });
});
test('results include accurate feedback for each prepared section', () => {
  const song = chooseSongDifficulty(SONG_CHALLENGES[0], 'Easy');
  let state = createSongState(song.notes);
  for (const note of song.notes) state = hitSongNote(state, note.drum, note.timeMs).state;
  const result = songResult(song, state);
  assert.equal(result.sectionResults?.length, 4);
  assert.ok(result.sectionResults?.every(section => section.accuracy === 100));
  assert.equal(result.sectionResults?.reduce((total, section) => total + section.hits, 0), song.notes.length);
});
for (const song of RECORDING_CHALLENGES) {
  test('sample recording is bundled and credits remain available: ' + song.title, async () => {
    const bytes = await readFile(new URL('../public/' + song.music!.src, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
    assert.ok(song.song?.credit?.url.startsWith('https://commons.wikimedia.org/'));
    assert.equal(song.song?.chartSource, 'demo');
  });
}
