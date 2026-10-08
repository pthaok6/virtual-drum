import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SONG_CHALLENGES, SONG_INTRO_MS } from '../src/data/songs';
import { createSongState, hitSongNote, expireSongNotes, songResult, HIT_WINDOW_MS } from '../src/services/rhythm';

for (const challenge of SONG_CHALLENGES) {
  test('song audio and beat chart stay synchronized: ' + challenge.title, async () => {
    const wav = await readFile(new URL('../public/' + challenge.music!.src, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    const rate = wav.readUInt32LE(24); const channels = wav.readUInt16LE(22); const bits = wav.readUInt16LE(34);
    const duration = wav.readUInt32LE(40) / (rate * channels * bits / 8);
    assert.ok(Math.abs(duration - challenge.durationSeconds) < 1 / rate);
    assert.equal(challenge.notes[0].timeMs, SONG_INTRO_MS);
    assert.ok(challenge.notes.at(-1)!.timeMs < duration * 1000 - HIT_WINDOW_MS);
    const step = 30000 / challenge.bpm;
    challenge.notes.forEach((note, index) => assert.ok(Math.abs(note.timeMs - SONG_INTRO_MS - index * step) <= 0.5));
    assert.ok(wav.subarray(44).some(byte => byte !== 0));
  });
}
const challenge = SONG_CHALLENGES[0];
const first = challenge.notes[0];
test('timed scoring distinguishes perfect, good, and wrong-drum hits', () => {
  const initial = createSongState(challenge.notes);
  const perfect = hitSongNote(initial, first.drum, first.timeMs + 25);
  assert.equal(perfect.rating, 'perfect'); assert.equal(perfect.state.score, 300); assert.equal(perfect.state.combo, 1);
  const good = hitSongNote(initial, first.drum, first.timeMs + 100);
  assert.equal(good.rating, 'good'); assert.equal(good.state.score, 200);
  const wrong = hitSongNote(initial, 'crash', first.timeMs);
  assert.equal(wrong.rating, 'miss'); assert.equal(wrong.state.notes[0].hit, false);
  assert.equal(initial.notes[0].hit, false);
});
test('notes cannot score twice and misses advance without user input', () => {
  let state = createSongState(challenge.notes);
  state = hitSongNote(state, first.drum, first.timeMs).state;
  const repeated = hitSongNote(state, first.drum, first.timeMs);
  assert.equal(repeated.rating, 'miss'); assert.equal(repeated.state.score, 300);
  const missed = expireSongNotes(createSongState(challenge.notes), first.timeMs + HIT_WINDOW_MS + 1);
  assert.equal(missed.notes[0].hitRating, 'miss'); assert.equal(missed.misses, 1);
  assert.equal(expireSongNotes(missed, first.timeMs + HIT_WINDOW_MS + 1), missed);
});
test('perfect performance produces S rank; unattended completion produces zero accuracy', () => {
  let state = createSongState(challenge.notes);
  for (const note of challenge.notes) state = hitSongNote(state, note.drum, note.timeMs).state;
  const result = songResult(challenge, state);
  assert.equal(result.rank, 'S'); assert.equal(result.accuracy, 100); assert.equal(result.score, result.maxScore);
  assert.equal(result.replayEvents?.length, challenge.notes.length);
  const empty = songResult(challenge, createSongState(challenge.notes));
  assert.equal(empty.accuracy, 0); assert.equal(empty.rank, 'D'); assert.equal(empty.misses, challenge.notes.length);
});
