export type ScreenType = 'home' | 'free-play' | 'challenge-select' | 'rhythm-game' | 'result' | 'leaderboard';

export type DrumType = 'kick' | 'snare' | 'hihat' | 'tom' | 'crash';

export type DrumKitPreset = 'acoustic' | 'electronic' | 'rock';

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
  velocity?: number;
  x?: number;
  y?: number;
  timestamp: number;
}

export interface RecordedHit {
  id: string;
  drum: DrumType;
  timestampMs: number;
  velocity: number;
}

export interface DrumLoopData {
  hits: RecordedHit[];
  durationMs: number;
  recordedAt: number;
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
  drumKitPreset: DrumKitPreset;
  velocitySensitivity: number; // default 1.0
}

// ==========================================
// USER, AUTH & LEADERBOARD INTERFACES
// ==========================================

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatarUrl: string;
  level: number;
  totalScore: number;
  createdAt: number;
}

export interface PlayRecord {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  trackId: string;
  trackTitle: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  timestamp: number;
}

export interface PersonalBest {
  trackId: string;
  highScore: number;
  accuracy: number;
  maxCombo: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  updatedAt: number;
}

export interface LeaderboardEntry extends PlayRecord {
  isCurrentUser?: boolean;
}

/**
 * Storage and Auth Adapter interfaces for easy swap to NextAuth, Supabase, or Firebase
 */
export interface IAuthAdapter {
  getCurrentUser(): Promise<UserProfile | null>;
  login(email: string, password: string): Promise<UserProfile>;
  register(email: string, username: string, password: string): Promise<UserProfile>;
  logout(): Promise<void>;
  updateUserStats(userId: string, addedScore: number): Promise<UserProfile>;
}

export interface IStorageService {
  savePlayRecord(record: Omit<PlayRecord, 'id' | 'timestamp'>): Promise<PlayRecord>;
  getLeaderboard(trackId?: string, limit?: number): Promise<LeaderboardEntry[]>;
  getPersonalBest(userId: string, trackId: string): Promise<PersonalBest | null>;
  getAllPersonalBests(userId: string): Promise<Record<string, PersonalBest>>;
  getUserHistory(userId: string): Promise<PlayRecord[]>;
}
