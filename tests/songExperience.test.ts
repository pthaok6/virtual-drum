import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SONG_CHALLENGES } from '../src/data/songs';
import { RECORDING_CHALLENGES } from '../src/data/recordings';
import { chooseSongDifficulty, demoAnalysis, songSections } from '../src/services/songExperience';
import { buildCustomChallenge } from '../src/services/songLibrary';
import { createSongState, hitSongNote, songResult } from '../src/services/rhythm';

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
