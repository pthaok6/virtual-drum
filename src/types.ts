export type ScreenType = 'home' | 'free-play' | 'challenge-select' | 'rhythm-game' | 'result';

export type DrumType = 'kick' | 'snare' | 'hihat' | 'tom' | 'crash';

export interface NormalizedZone {
  x: number; // Left %
  y: number; // Top %
  width: number; // Width %
  height: number; // Height %
}

export interface DrumInfo {
  id: DrumType;
  name: string;
  subtitle: string;
  key: string;
  color: string;
  glowColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  // Gesture detection uses this exact visible drum rectangle.
  visualZone: NormalizedZone;
}

export type HitRating = 'perfect' | 'good' | 'miss';

export interface HitFeedback {
  id: string;
  drum: DrumType;
  rating?: HitRating;
  x?: number;
  y?: number;
  timestamp: number;
}

export interface BeatNote {
  id: string;
  drum: DrumType;
  timeMs: number; // Exact millisecond when it should be hit
  hit?: boolean;
  hitRating?: HitRating;
}

export interface RhythmChallenge {
  id: string;
  title: string;
  artist: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bpm: number;
  durationSeconds: number;
  description: string;
  notes: BeatNote[];
}

export interface GameResult {
  challenge: RhythmChallenge;
  score: number;
  maxScore: number;
  accuracy: number;
  maxCombo: number;
  perfectHits: number;
  goodHits: number;
  misses: number;
  stars: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface AppSettings {
  cameraEnabled: boolean;
  selectedCameraId: string;
  mirrorCamera: boolean;
  showHandIndicators: boolean;
  volume: number; // 0 to 1
  sfxEnabled: boolean;
  visualEffectsEnabled: boolean;
}
