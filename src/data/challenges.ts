import { BeatNote, DrumType, RhythmChallenge } from '../types';

/**
 * Helper to generate an authentic, musical rhythm pattern
 */
function generatePattern(
  bpm: number,
  bars: number,
  pattern: { step: number; drum: DrumType }[],
  stepsPerBar: number = 8
): BeatNote[] {
  const stepMs = 60000 / bpm / (stepsPerBar / 4); // ms per step
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
  // ==========================================
  // EASY LEVEL (Dễ: 75 - 84 BPM)
  // ==========================================
  {
    id: 'beginner-beat',
    title: 'Beginner Beat',
    artist: 'Virtual Drum Academy',
    difficulty: 'Easy',
    bpm: 75,
    durationSeconds: 22,
    description:
      'Learn the fundamental heartbeat: Kick on 1 & 3, Snare on 2 & 4. Relaxed tempo ideal for mastering hand gestures.',
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
    id: 'pop-pulse',
    title: 'Pop Pulse',
    artist: 'Neon City Beats',
    difficulty: 'Easy',
    bpm: 84,
    durationSeconds: 24,
    description:
      'Four-on-the-floor modern dance-pop groove with steady hi-hat drive and snappy snare claps on beats 2 and 4.',
    notes: generatePattern(
      84,
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
    id: 'lofi-chill',
    title: 'Lo-Fi Chill Hop',
    artist: 'Midnight Coffee',
    difficulty: 'Easy',
    bpm: 80,
    durationSeconds: 25,
    description:
      'Relaxed boom-bap rhythm featuring laid-back kick drops, gentle snare snaps, and off-beat hi-hat swings.',
    notes: generatePattern(
      80,
      7,
      [
        { step: 0, drum: 'kick' },
        { step: 2, drum: 'hihat' },
        { step: 3, drum: 'kick' },
        { step: 4, drum: 'snare' },
        { step: 6, drum: 'hihat' },
        { step: 7, drum: 'tom' },
      ],
      8
    ),
  },

  // ==========================================
  // MEDIUM LEVEL (Trung bình: 96 - 120 BPM)
  // ==========================================
  {
    id: 'basic-rock',
    title: 'Basic Rock',
    artist: 'Garage Groover',
    difficulty: 'Medium',
    bpm: 96,
    durationSeconds: 26,
    description:
      'Classic eight-beat rock groove: Steady hi-hat eighth notes paired with a driving kick and crisp snare.',
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
        { step: 7, drum: 'crash' },
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
    description:
      'Bouncy syncopations incorporating toms and off-beat snare pops with hi-hat sizzles. Great for rhythm pocket timing.',
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
    id: 'synthwave-drive',
    title: 'Synthwave Drive',
    artist: 'Retro Laser 84',
    difficulty: 'Medium',
    bpm: 120,
    durationSeconds: 28,
    description:
      'Driving 80s arcade beat with 4-on-the-floor kicks, powerful snare gates, and energetic tom transitions.',
    notes: generatePattern(
      120,
      8,
      [
        { step: 0, drum: 'kick' },
        { step: 1, drum: 'hihat' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'tom' },
        { step: 4, drum: 'kick' },
        { step: 5, drum: 'hihat' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'crash' },
      ],
      8
    ),
  },

  // ==========================================
  // HARD LEVEL (Khó: 128 - 140 BPM)
  // ==========================================
  {
    id: 'fast-beat',
    title: 'Punk Energy',
    artist: 'Skatepark Rejects',
    difficulty: 'Hard',
    bpm: 132,
    durationSeconds: 28,
    description:
      'High-octane tempo with crashing downbeats, tom fills, and lightning fast kick-snare alternations.',
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
  {
    id: 'samba-carnival',
    title: 'Samba Carnival',
    artist: 'Rio Percussion Ensemble',
    difficulty: 'Hard',
    bpm: 128,
    durationSeconds: 30,
    description:
      'Poly-rhythmic Latin party groove with rapid hi-hat 16ths, dancing tom rhythms, and unexpected syncopated snare accents.',
    notes: generatePattern(
      128,
      9,
      [
        { step: 0, drum: 'kick' },
        { step: 1, drum: 'tom' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'hihat' },
        { step: 4, drum: 'kick' },
        { step: 5, drum: 'tom' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'hihat' },
      ],
      8
    ),
  },
  {
    id: 'dubstep-wobble',
    title: 'Dubstep Half-Time',
    artist: 'BassDrop Protocol',
    difficulty: 'Hard',
    bpm: 140,
    durationSeconds: 30,
    description:
      'Half-time heavy dubstep rhythm featuring colossal kick drops, snare hits on beat 3, and rapid tom fill stutter patterns.',
    notes: generatePattern(
      140,
      9,
      [
        { step: 0, drum: 'kick' },
        { step: 2, drum: 'hihat' },
        { step: 4, drum: 'snare' },
        { step: 5, drum: 'tom' },
        { step: 6, drum: 'tom' },
        { step: 7, drum: 'crash' },
      ],
      8
    ),
  },

  // ==========================================
  // EXPERT LEVEL (Cực Khó: 160 - 174 BPM)
  // ==========================================
  {
    id: 'metal-fury',
    title: 'Metal Blast Beat',
    artist: 'Infernal Abyss',
    difficulty: 'Expert',
    bpm: 160,
    durationSeconds: 32,
    description:
      'Relentless extreme metal blast beat! Double-time kick-snare machine gun alternations and cascading crash cymbals.',
    notes: generatePattern(
      160,
      12,
      [
        { step: 0, drum: 'crash' },
        { step: 1, drum: 'kick' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'kick' },
        { step: 4, drum: 'snare' },
        { step: 5, drum: 'kick' },
        { step: 6, drum: 'tom' },
        { step: 7, drum: 'crash' },
      ],
      8
    ),
  },
  {
    id: 'speed-demon-dnb',
    title: 'Speed Demon Drum & Bass',
    artist: 'Sonic Velocity',
    difficulty: 'Expert',
    bpm: 174,
    durationSeconds: 30,
    description:
      'Breakneck jungle / DnB breakbeat at 174 BPM. Tests the outer limits of your hand reaction speed with syncopated ghost snares and rapid cymbal bursts.',
    notes: generatePattern(
      174,
      12,
      [
        { step: 0, drum: 'kick' },
        { step: 1, drum: 'hihat' },
        { step: 2, drum: 'snare' },
        { step: 3, drum: 'hihat' },
        { step: 4, drum: 'hihat' },
        { step: 5, drum: 'kick' },
        { step: 6, drum: 'snare' },
        { step: 7, drum: 'crash' },
      ],
      8
    ),
  },
];
