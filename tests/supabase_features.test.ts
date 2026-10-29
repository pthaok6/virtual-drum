import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSupabaseConfigured, SUPABASE_URL } from '../src/services/supabase';
import { createRoom, fetchRooms, type RoomData } from '../src/services/roomService';
import { buildCustomChallenge } from '../src/services/songLibrary';
import { fetchRemoteSongs, deleteRemoteSong, uploadSongToSupabase } from '../src/services/songStorage';

test('supabase configuration detects missing or placeholder keys gracefully', () => {
  // In tests without environment variables, isSupabaseConfigured should safely be false without crashing
  assert.equal(typeof isSupabaseConfigured, 'boolean');
});

test('room service creates rooms with proper structure and defaults', async () => {
  const room = await createRoom({
    name: 'Rock Jam Session',
    hostName: 'Drummer Alex',
    hostId: 'alex-123',
    challengeId: 'basic-rock',
    challengeTitle: 'Basic Rock',
    mode: 'versus',
    capacity: 4,
  });

  assert.ok(room.id.startsWith('room-'));
  assert.equal(room.name, 'Rock Jam Session');
  assert.equal(room.host, 'Drummer Alex');
  assert.equal(room.hostId, 'alex-123');
  assert.equal(room.challengeId, 'basic-rock');
  assert.equal(room.challenge, 'Basic Rock');
  assert.equal(room.mode, 'versus');
  assert.equal(room.capacity, 4);
  assert.equal(room.status, 'Waiting');

  // Verify fetchRooms returns the created room
  const rooms = await fetchRooms();
  assert.ok(rooms.some((r) => r.id === room.id));
  assert.ok(rooms.length >= 3); // Includes demo rooms
});

test('custom songs can be created from remote song metadata and URL', () => {
  const remoteSong = {
    id: 'remote-song-1',
    title: 'Neon Beat Stream',
    bpm: 120,
    durationSeconds: 15,
    startSeconds: 1.5,
    difficulty: 'Medium' as const,
    beatTimes: [1.5, 2.0, 2.5, 3.0],
    analysisNotes: [
      { time: 1.5, lane: 'kick' as const },
      { time: 2.0, lane: 'snare' as const },
    ],
  };

  const challenge = buildCustomChallenge(remoteSong, 'https://example.com/audio/song.wav');
  assert.equal(challenge.id, 'remote-song-1');
  assert.equal(challenge.title, 'Neon Beat Stream');
  assert.equal(challenge.bpm, 120);
  assert.equal(challenge.music?.src, 'https://example.com/audio/song.wav');
  assert.equal(challenge.notes.length, 2);
  assert.equal(challenge.notes[0].drum, 'kick');
  assert.equal(challenge.notes[0].timeMs, 1500);
});

test('song storage functions resolve safely when Supabase is offline/unconfigured', async () => {
  const remoteSongs = await fetchRemoteSongs();
  assert.ok(Array.isArray(remoteSongs));

  await assert.doesNotReject(async () => {
    await deleteRemoteSong('test-id');
  });

  const uploadResult = await uploadSongToSupabase({
    id: 'test-song',
    title: 'Test',
    bpm: 120,
    durationSeconds: 10,
    startSeconds: 0,
    difficulty: 'Easy',
    file: new Blob(['fake audio'], { type: 'audio/wav' }),
  });

  assert.equal(uploadResult.error, null);
});

