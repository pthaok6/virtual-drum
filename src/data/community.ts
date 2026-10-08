import { CHALLENGES } from './challenges';
import { GameResult } from '../types';

export interface CommunityUser {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  bio: string;
  followers: number;
  totalScore: number;
}

export interface ReplayClip {
  id: string;
  userId: string;
  title: string;
  generatedTitle?: boolean;
  challengeId: string;
  score: number;
  accuracy: number;
  rank: GameResult['rank'];
  date: string;
  shared: boolean;
  events: NonNullable<GameResult['replayEvents']>;
}

export const USERS: CommunityUser[] = [
  { id: 'you', name: "You", handle: '@you', initials: 'Y', color: 'from-rose-500 to-amber-500', bio: "Practice keeping time every day and share your favorite performances.", followers: 128, totalScore: 18420 },
  { id: 'mai-beats', name: 'Mai Beats', handle: '@mai.beats', initials: 'MB', color: 'from-fuchsia-500 to-rose-500', bio: "I love rock grooves, crisp snare hits, and speed challenges.", followers: 1240, totalScore: 24980 },
  { id: 'linh-groove', name: 'Linh Groove', handle: '@linh.groove', initials: 'LG', color: 'from-cyan-500 to-blue-500', bio: "Collecting cheerful grooves from every corner of the city.", followers: 864, totalScore: 23150 },
  { id: 'khoa-drum', name: 'Khoa Drum', handle: '@khoa.drum', initials: 'KD', color: 'from-amber-400 to-orange-600', bio: "A great kick beat can change your entire day.", followers: 521, totalScore: 21900 },
];

const demoEvents = (challengeId: string) => CHALLENGES.find((challenge) => challenge.id === challengeId)!.notes.slice(0, 18).map((note, index) => ({
  drum: note.drum,
  rating: (index === 7 ? 'miss' : 'perfect') as 'miss' | 'perfect',
  timeMs: note.timeMs - 1800,
}));

export const DEMO_CLIPS: ReplayClip[] = [
  { id: 'demo-you', userId: 'you', title: "Warm-up beat", challengeId: 'beginner-beat', score: 18420, accuracy: 96, rank: 'S', date: "Yesterday", shared: true, events: demoEvents('beginner-beat') },
  { id: 'demo-mai', userId: 'mai-beats', title: "Steady rock groove", challengeId: 'basic-rock', score: 24980, accuracy: 98, rank: 'S', date: "2 hours ago", shared: true, events: demoEvents('basic-rock') },
  { id: 'demo-linh', userId: 'linh-groove', title: "A little evening funk", challengeId: 'funky-groove', score: 23150, accuracy: 94, rank: 'A', date: "Today", shared: true, events: demoEvents('funky-groove') },
  { id: 'demo-khoa', userId: 'khoa-drum', title: "Keeping time together", challengeId: 'beginner-beat', score: 21900, accuracy: 92, rank: 'A', date: "Yesterday", shared: true, events: demoEvents('beginner-beat') },
];

export const ROOMS = [
  { id: 'studio-night', name: "Tonight's studio", host: 'Mai Beats', players: 3, capacity: 4, challenge: 'Basic Rock', status: "Waiting", color: 'rose' },
  { id: 'funk-session', name: 'Funk Session', host: 'Linh Groove', players: 2, capacity: 4, challenge: 'Funky Groove', status: "Waiting", color: 'cyan' },
  { id: 'first-beat', name: "First beat", host: 'Khoa Drum', players: 1, capacity: 4, challenge: 'Beginner Beat', status: "Waiting", color: 'amber' },
];
