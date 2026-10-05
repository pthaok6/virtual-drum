import { BeatNote, DrumType, RhythmChallenge } from '../types';

// Helper to generate a repetitive drum pattern
function generatePattern(
  bpm: number,
  bars: number,
  pattern: { step: number; drum: DrumType }[],
  stepsPerBar: number = 8
): BeatNote[] {
  const stepMs = (60000 / bpm) / (stepsPerBar / 4); // ms per step
  const notes: BeatNote[] = [];
  let noteIdx = 0;

  for (let bar = 0; bar < bars; bar++) {
    const barStartMs = bar * stepsPerBar * stepMs + 1800; // 1.8s intro grace period
    for (const p of pattern) {
      notes.push({
        id: `note-${bar}-${noteIdx++}`,
        drum: p.drum,
        timeMs: Math.round(barStartMs + p.step * stepMs),
      });
    }
  }

  return notes.sort((a, b) => a.timeMs - b.timeMs);
}

export const CHALLENGES: RhythmChallenge[] = [
  {
    id: 'beginner-beat',
    title: 'Beginner Beat',
    artist: 'Virtual Drum Academy',
    difficulty: 'Easy',
    bpm: 75,
    durationSeconds: 22,
    description: 'Learn the fundamental heartbeat: Kick on 1 & 3, Snare on 2 & 4. Relaxed tempo ideal for mastering hand gestures.',
    notes: generatePattern(
      75,
      6,
      [
        { step: 0, drum: 'kick' },
        { step: 2, drum: 'snare' },
        { step: 4, drum: 'kick' },
        { step: 6, drum: 'snare' },
      ],
      8
    ),
  },
  {
    id: 'basic-rock',
    title: 'Basic Rock',
    artist: 'Garage Groover',
    difficulty: 'Medium',
    bpm: 96,
    durationSeconds: 26,
    description: 'Classic eight-beat rock groove: Steady hi-hat eighth notes paired with a driving kick and crisp snare.',
    notes: generatePattern(
      96,
      7,
      [
        { step: 0, drum: 'kick' },
        { step: 1, drum: 'hihat' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'hihat' },
        { step: 4, drum: 'kick' },
        { step: 5, drum: 'hihat' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'hihat' },
      ],
      8
    ),
  },
  {
    id: 'funky-groove',
    title: 'Funky Groove',
    artist: 'Syncopate Collective',
    difficulty: 'Medium',
    bpm: 112,
    durationSeconds: 28,
    description: 'Bouncy syncopations incorporating toms and off-beat snare pops with hi-hat sizzles.',
    notes: generatePattern(
      112,
      8,
      [
        { step: 0, drum: 'kick' },
        { step: 1, drum: 'hihat' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'tom' },
        { step: 4, drum: 'kick' },
        { step: 5, drum: 'kick' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'hihat' },
      ],
      8
    ),
  },
  {
    id: 'fast-beat',
    title: 'Fast Beat',
    artist: 'Pulse Overdrive',
    difficulty: 'Hard',
    bpm: 132,
    durationSeconds: 28,
    description: 'High octane tempo with crashing downbeats, tom fills, and lightning fast kick-snare alternations.',
    notes: generatePattern(
      132,
      10,
      [
        { step: 0, drum: 'crash' },
        { step: 1, drum: 'kick' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'hihat' },
        { step: 4, drum: 'tom' },
        { step: 5, drum: 'kick' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'crash' },
      ],
      8
    ),
  },
];
