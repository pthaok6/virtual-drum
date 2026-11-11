import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomChallenge, musicSource, readAudioDuration } from '../src/services/songLibrary';

const song = { id: 'custom-test', title: 'My song', bpm: 120, durationSeconds: 30, startSeconds: 2, difficulty: 'Easy' as const };
test('imported audio chart follows BPM and first-beat offset and ends within the song', () => {
  const challenge = buildCustomChallenge(song, 'blob:test');
  assert.equal(challenge.music?.src, 'blob:test');
  assert.equal(challenge.music?.introMs, 2000);
  assert.equal(challenge.notes[0].timeMs, 2000);
  assert.equal(challenge.notes[1].timeMs - challenge.notes[0].timeMs, 500);
  assert.ok(challenge.notes.at(-1)!.timeMs < song.durationSeconds * 1000 - 180);
  const medium = buildCustomChallenge({ ...song, difficulty: 'Medium' }, 'blob:test');
  assert.equal(medium.notes[1].timeMs - medium.notes[0].timeMs, 250);
  assert.ok(medium.notes.length > challenge.notes.length);
});
test('saved song metadata can regenerate the chart with a new playback URL', () => {
  const original = buildCustomChallenge(song, 'blob:original');
  const restored = buildCustomChallenge(JSON.parse(JSON.stringify(song)), 'blob:restored');
  assert.deepEqual(restored.notes, original.notes);
  assert.equal(restored.music?.src, 'blob:restored');
  assert.equal(restored.id, original.id);
});

test('analyzed uploads immediately use the chosen chart, including restored dense Easy songs', () => {
  const analysisNotes = Array.from({ length: 21 }, (_, index) => ({ time: 2 + index * 0.1, lane: 'snare' as const }));
  const easy = buildCustomChallenge({ ...song, analysisNotes }, 'blob:easy');
  const medium = buildCustomChallenge({ ...song, difficulty: 'Medium', analysisNotes }, 'blob:medium');
  assert.equal(easy.notes.length, 5);
  assert.equal(medium.notes.length, analysisNotes.length);
  assert.deepEqual(easy.notes, easy.song!.charts.Easy);
  assert.ok(easy.notes.every((note, index, notes) => !index || note.timeMs - notes[index - 1].timeMs >= 500));
  assert.deepEqual(easy.song!.charts.Medium, medium.notes);
  const restored = buildCustomChallenge(JSON.parse(JSON.stringify({ ...song, analysisNotes })), 'blob:restored');
  assert.deepEqual(restored.notes, easy.notes);
});
test('invalid title, tempo, duration, or beat offset is rejected', () => {
  for (const partial of [{ title: ' ' }, { bpm: 0 }, { bpm: 241 }, { bpm: NaN }, { durationSeconds: Infinity }, { durationSeconds: 601 }, { durationSeconds: 2 }, { startSeconds: -1 }, { startSeconds: 29.5 }]) {
    assert.throws(() => buildCustomChallenge({ ...song, ...partial }, 'blob:test'));
  }
});
test('local blob URLs and bundled song paths resolve correctly', () => {
  assert.equal(musicSource('blob:https://example.test/song', '/drum/'), 'blob:https://example.test/song');
  assert.equal(musicSource('audio/neon-drive.wav', '/drum/'), '/drum/audio/neon-drive.wav');
});
test('empty files and unsupported formats are rejected before loading audio', async () => {
  await assert.rejects(readAudioDuration(new File([], 'empty.mp3', { type: 'audio/mpeg' })));
  await assert.rejects(readAudioDuration(new File(['text'], 'notes.txt', { type: 'text/plain' })));
});
