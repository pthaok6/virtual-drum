import { mkdir, writeFile } from 'node:fs/promises';
import { SONGS, SONG_INTRO_MS } from '../src/data/songs';

// Original arrangements: melody, harmony, bass, and a quiet drum guide.
// Generated locally, with no third-party recordings or remote audio services.
const sampleRate = 22050;
const output = new URL('../public/audio/', import.meta.url);
await mkdir(output, { recursive: true });
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
for (const song of SONGS) {
  const beat = 60 / song.bpm;
  const duration = SONG_INTRO_MS / 1000 + song.bars * beat * 4 + 1;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  function tone(midi: number, start: number, length: number, amplitude: number, brightness = 0.25) {
    const f = frequency(midi);
    for (let i = 0; i < length * sampleRate; i++) {
      const index = Math.round(start * sampleRate) + i;
      if (index >= samples.length) break;
      const seconds = i / sampleRate;
      const envelope = Math.min(1, seconds / 0.012) * Math.min(1, (length - seconds) / 0.06);
      samples[index] += amplitude * envelope * (Math.sin(2 * Math.PI * f * seconds) + brightness * Math.sin(4 * Math.PI * f * seconds));
    }
  }
  function drum(kind: string, start: number) {
    const length = kind === 'crash' ? 0.6 : kind === 'hihat' ? 0.08 : 0.22;
    for (let i = 0; i < length * sampleRate; i++) {
      const index = Math.round(start * sampleRate) + i;
      if (index >= samples.length) break;
      const seconds = i / sampleRate;
      const envelope = Math.exp(-seconds * (kind === 'hihat' ? 55 : 18));
      const pitched = Math.sin(2 * Math.PI * (kind === 'kick' ? 55 * seconds + 5 * (1 - Math.exp(-seconds * 35)) : 130 * seconds));
      // Deterministic noise keeps asset regeneration reproducible.
      const noise = 2 * ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1) / 2;
      const wave = kind === 'kick' || kind === 'tom' ? pitched : kind === 'snare' ? noise * 0.7 + pitched * 0.3 : noise;
      samples[index] += wave * envelope * (kind === 'kick' ? 0.18 : 0.09);
    }
  }
  for (let count = 0; count < 3; count++) tone(count === 2 ? 84 : 72, count * 0.6, 0.1, 0.15, 0);
  for (let bar = 0; bar < song.bars; bar++) {
    const start = SONG_INTRO_MS / 1000 + bar * beat * 4;
    const root = song.roots[bar % song.roots.length];
    [root + 12, root + 16, root + 19].forEach(note => tone(note, start, beat * 3.9, 0.045, 0.08));
    for (let step = 0; step < 8; step++) {
      const at = start + step * beat / 2;
      tone(root - 12 + (step === 5 ? 7 : 0), at, beat * 0.38, 0.12, 0.1);
      const melody = song.melody[(step + (bar % 2) * 2) % song.melody.length];
      tone(melody, at, beat * 0.4, 0.105, 0.3);
      drum(song.pattern[step], at);
    }
  }
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.tanh(samples[i]) * 29000), 44 + i * 2);
  await writeFile(new URL(song.id + '.wav', output), wav);
  console.log(song.title + ': ' + duration.toFixed(1) + 's, ' + song.bpm + ' BPM');
}
