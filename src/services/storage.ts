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

export { calculateUserLevel, generateDefaultAvatar } from './authUtils';
import { calculateUserLevel, generateDefaultAvatar } from './authUtils';
import { getSupabaseConfig } from './supabase';
import { SupabaseAuthAdapter } from './supabaseAuth';
import { SupabaseStorageService } from './supabaseStorage';

export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.username.toLowerCase() === 'admin' ||
    user.email.toLowerCase().startsWith('admin@') ||
    user.email.toLowerCase() === 'admin'
  );
}

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

    const isAdmin = email.toLowerCase().startsWith('admin@') || email.toLowerCase() === 'admin';

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
        role: isAdmin || username.toLowerCase() === 'admin' ? 'admin' : 'user',
      };
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } else if (isAdmin || user.username.toLowerCase() === 'admin') {
      user.role = 'admin';
    }

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  }

  public async register(email: string, username: string, _password: string): Promise<UserProfile> {
    const users = this.getAllUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const isAdmin = username.toLowerCase() === 'admin' || email.toLowerCase().startsWith('admin@') || email.toLowerCase() === 'admin';

    if (existing) {
      if (isAdmin) existing.role = 'admin';
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
      role: isAdmin ? 'admin' : 'user',
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
    this.clearOldLeaderboardData();
  }

  private clearOldLeaderboardData() {
    try {
      const resetLeaderboardKey = 'v_drum_clear_all_leaderboard_v2';
      if (!localStorage.getItem(resetLeaderboardKey)) {
        localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify([]));
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(STORAGE_KEYS.PERSONAL_BESTS)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem(resetLeaderboardKey, 'true');
      }
    } catch (e) {
      console.warn('Could not reset leaderboard data:', e);
    }
  }

  public clearLeaderboard(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify([]));
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(STORAGE_KEYS.PERSONAL_BESTS)) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
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

    // Deduplicate so each registered account only appears once with their highest score achieved
    const bestByAccount = new Map<string, PlayRecord>();
    for (const record of filtered) {
      // Exclude guests: only registered users can appear on leaderboard
      if (!record.userId || record.userId.startsWith('guest')) {
        continue;
      }

      const accountKey = record.userId;

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
      if (!data) return [];
      const parsed: PlayRecord[] = JSON.parse(data);
      return parsed.filter((r) => r.userId && !r.userId.startsWith('guest'));
    } catch {
      return [];
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

