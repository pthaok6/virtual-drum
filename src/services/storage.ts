import {
  IAuthAdapter,
  IStorageService,
  LeaderboardEntry,
  PersonalBest,
  PlayRecord,
  UserProfile,
} from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'v_drum_current_user',
  USERS: 'v_drum_users',
  PLAY_RECORDS: 'v_drum_play_records',
  PERSONAL_BESTS: 'v_drum_personal_bests',
};

// Realistic seed data for the global leaderboard
const SEED_RECORDS: PlayRecord[] = [
  {
    id: 'rec-seed-1',
    userId: 'seed-u1',
    username: 'NeonPulse99',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonPulse',
    trackId: 'fast-beat',
    trackTitle: 'Fast Beat',
    score: 18450,
    accuracy: 98.4,
    maxCombo: 80,
    rank: 'S',
    timestamp: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'rec-seed-2',
    userId: 'seed-u2',
    username: 'GrooveMaster',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=GrooveMaster',
    trackId: 'funky-groove',
    trackTitle: 'Funky Groove',
    score: 15200,
    accuracy: 96.8,
    maxCombo: 64,
    rank: 'S',
    timestamp: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: 'rec-seed-3',
    userId: 'seed-u3',
    username: 'RockStarAlex',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    trackId: 'basic-rock',
    trackTitle: 'Basic Rock',
    score: 13800,
    accuracy: 94.2,
    maxCombo: 56,
    rank: 'A',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'rec-seed-4',
    userId: 'seed-u4',
    username: 'AcousticSoul',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Soul',
    trackId: 'beginner-beat',
    trackTitle: 'Beginner Beat',
    score: 7200,
    accuracy: 100.0,
    maxCombo: 24,
    rank: 'S',
    timestamp: Date.now() - 1000 * 60 * 60 * 36,
  },
  {
    id: 'rec-seed-5',
    userId: 'seed-u5',
    username: 'CyberPercussion',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
    trackId: 'fast-beat',
    trackTitle: 'Fast Beat',
    score: 16100,
    accuracy: 92.5,
    maxCombo: 68,
    rank: 'A',
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
  },
];

export { calculateUserLevel, generateDefaultAvatar } from './authUtils';
import { calculateUserLevel, generateDefaultAvatar } from './authUtils';
import { getSupabaseConfig } from './supabase';
import { SupabaseAuthAdapter } from './supabaseAuth';
import { SupabaseStorageService } from './supabaseStorage';

/**
 * LocalStorage implementation of IAuthAdapter
 */
export class LocalStorageAuthAdapter implements IAuthAdapter {
  public async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      return JSON.parse(data) as UserProfile;
    } catch {
      return null;
    }
  }

  public async login(email: string, _password: string): Promise<UserProfile> {
    // Look up user in saved users or create demo session
    const users = this.getAllUsers();
    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      const username = email.split('@')[0] || 'Drummer';
      user = {
        id: `user-${Date.now()}`,
        email,
        username,
        avatarUrl: generateDefaultAvatar(username),
        level: 1,
        totalScore: 0,
        createdAt: Date.now(),
      };
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  }

  public async register(email: string, username: string, _password: string): Promise<UserProfile> {
    const users = this.getAllUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      // Log in existing
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));
      return existing;
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      email,
      username: username.trim() || email.split('@')[0],
      avatarUrl: generateDefaultAvatar(username),
      level: 1,
      totalScore: 0,
      createdAt: Date.now(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    return newUser;
  }

  public async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  public async updateUserStats(userId: string, addedScore: number): Promise<UserProfile> {
    const users = this.getAllUsers();
    const idx = users.findIndex((u) => u.id === userId);
    let currentUser = await this.getCurrentUser();

    if (idx !== -1) {
      users[idx].totalScore += addedScore;
      users[idx].level = calculateUserLevel(users[idx].totalScore);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      if (currentUser && currentUser.id === userId) {
        currentUser = users[idx];
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      }
      return users[idx];
    } else if (currentUser) {
      currentUser.totalScore += addedScore;
      currentUser.level = calculateUserLevel(currentUser.totalScore);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      return currentUser;
    }

    throw new Error('User not found');
  }

  private getAllUsers(): UserProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

/**
 * LocalStorage implementation of IStorageService for scores and leaderboards
 */
export class LocalStorageService implements IStorageService {
  constructor() {
    this.seedInitialDataIfNeeded();
  }

  private seedInitialDataIfNeeded() {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
      if (!existing) {
        localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(SEED_RECORDS));
      }
    } catch (e) {
      console.warn('Could not seed local storage:', e);
    }
  }

  public async savePlayRecord(recordData: Omit<PlayRecord, 'id' | 'timestamp'>): Promise<PlayRecord> {
    if (!recordData.userId || recordData.userId.startsWith('guest')) {
      return {
        ...recordData,
        id: `guest-${Date.now()}`,
        timestamp: Date.now(),
      };
    }

    const records = this.getAllRecords();
    const newRecord: PlayRecord = {
      ...recordData,
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    records.push(newRecord);
    localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(records));

    // Update Personal Best
    await this.updatePersonalBest(newRecord);

    return newRecord;
  }

  private async updatePersonalBest(record: PlayRecord): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.PERSONAL_BESTS}_${record.userId}`;
      const raw = localStorage.getItem(key);
      const bests: Record<string, PersonalBest> = raw ? JSON.parse(raw) : {};

      const current = bests[record.trackId];
      if (!current || record.score > current.highScore) {
        bests[record.trackId] = {
          trackId: record.trackId,
          highScore: record.score,
          accuracy: record.accuracy,
          maxCombo: record.maxCombo,
          rank: record.rank,
          updatedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(bests));
      }
    } catch (err) {
      console.warn('Failed to update personal best:', err);
    }
  }

  public async getLeaderboard(trackId?: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    const records = this.getAllRecords();
    let filtered = records;
    if (trackId && trackId !== 'all') {
      filtered = records.filter((r) => r.trackId === trackId);
    }

    // Deduplicate so each account only appears once with their highest score achieved
    const bestByAccount = new Map<string, PlayRecord>();
    for (const record of filtered) {
      // Use unique account key: userId for registered accounts, or username for guest
      const accountKey =
        record.userId && !record.userId.startsWith('guest-')
          ? record.userId
          : record.username.trim().toLowerCase();

      const existing = bestByAccount.get(accountKey);
      if (!existing) {
        bestByAccount.set(accountKey, record);
      } else {
        // Keep the record with higher score, or higher accuracy on tie
        if (
          record.score > existing.score ||
          (record.score === existing.score && record.accuracy > existing.accuracy)
        ) {
          bestByAccount.set(accountKey, record);
        }
      }
    }

    const uniqueLeaderboard = Array.from(bestByAccount.values());

    // Sort descending by score, then accuracy
    uniqueLeaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.accuracy - a.accuracy;
    });

    return uniqueLeaderboard.slice(0, limit);
  }

  public async getPersonalBest(userId: string, trackId: string): Promise<PersonalBest | null> {
    const all = await this.getAllPersonalBests(userId);
    return all[trackId] ?? null;
  }

  public async getAllPersonalBests(userId: string): Promise<Record<string, PersonalBest>> {
    try {
      const key = `${STORAGE_KEYS.PERSONAL_BESTS}_${userId}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public async getUserHistory(userId: string): Promise<PlayRecord[]> {
    const records = this.getAllRecords();
    return records
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private getAllRecords(): PlayRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
      return data ? JSON.parse(data) : [...SEED_RECORDS];
    } catch {
      return [...SEED_RECORDS];
    }
  }
}

/**
 * Composite Auth Adapter that dynamically delegates to Supabase when configured,
 * or falls back to LocalStorage.
 */
export class CompositeAuthAdapter implements IAuthAdapter {
  private localAdapter = new LocalStorageAuthAdapter();
  private supabaseAdapter = new SupabaseAuthAdapter();

  public getActiveAdapter(): IAuthAdapter {
    const config = getSupabaseConfig();
    return config.isConfigured ? this.supabaseAdapter : this.localAdapter;
  }

  public async getCurrentUser(): Promise<UserProfile | null> {
    return this.getActiveAdapter().getCurrentUser();
  }

  public async login(email: string, password: string): Promise<UserProfile> {
    return this.getActiveAdapter().login(email, password);
  }

  public async register(email: string, username: string, password: string): Promise<UserProfile> {
    return this.getActiveAdapter().register(email, username, password);
  }

  public async logout(): Promise<void> {
    return this.getActiveAdapter().logout();
  }

  public async updateUserStats(userId: string, addedScore: number): Promise<UserProfile> {
    return this.getActiveAdapter().updateUserStats(userId, addedScore);
  }
}

/**
 * Composite Storage Service that delegates to Supabase for cloud leaderboard / records,
 * and falls back to LocalStorage.
 */
export class CompositeStorageService implements IStorageService {
  private localService = new LocalStorageService();
  private supabaseService = new SupabaseStorageService();

  public getActiveService(): IStorageService {
    const config = getSupabaseConfig();
    return config.isConfigured ? this.supabaseService : this.localService;
  }

  public async savePlayRecord(record: Omit<PlayRecord, 'id' | 'timestamp'>): Promise<PlayRecord> {
    return this.getActiveService().savePlayRecord(record);
  }

  public async getLeaderboard(trackId?: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getActiveService().getLeaderboard(trackId, limit);
  }

  public async getPersonalBest(userId: string, trackId: string): Promise<PersonalBest | null> {
    return this.getActiveService().getPersonalBest(userId, trackId);
  }

  public async getAllPersonalBests(userId: string): Promise<Record<string, PersonalBest>> {
    return this.getActiveService().getAllPersonalBests(userId);
  }

  public async getUserHistory(userId: string): Promise<PlayRecord[]> {
    return this.getActiveService().getUserHistory(userId);
  }
}

// Singleton instances with dynamic Supabase / LocalStorage adapters
export const authAdapter: IAuthAdapter = new CompositeAuthAdapter();
export const storageService: IStorageService = new CompositeStorageService();

