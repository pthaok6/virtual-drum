import {
  IStorageService,
  LeaderboardEntry,
  PersonalBest,
  PlayRecord,
} from '../types';
import { getSupabaseClient } from './supabase';
import { LocalStorageService } from './storage';

export class SupabaseStorageService implements IStorageService {
  private localFallback = new LocalStorageService();

  public async savePlayRecord(
    recordData: Omit<PlayRecord, 'id' | 'timestamp'>
  ): Promise<PlayRecord> {
    const supabase = getSupabaseClient();
    const timestamp = Date.now();

    // Always keep local storage updated as fallback & cache
    const savedLocal = await this.localFallback.savePlayRecord(recordData);

    if (!supabase) {
      return savedLocal;
    }

    try {
      // If user is guest, don't insert invalid uuid into user_id
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        recordData.userId
      );

      const { data, error } = await supabase
        .from('play_records')
        .insert({
          user_id: isUuid ? recordData.userId : null,
          username: recordData.username,
          avatar_url: recordData.avatarUrl,
          track_id: recordData.trackId,
          track_title: recordData.trackTitle,
          score: recordData.score,
          accuracy: recordData.accuracy,
          max_combo: recordData.maxCombo,
          rank: recordData.rank,
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase savePlayRecord warning (using local):', error.message);
        return savedLocal;
      }

      if (data) {
        return {
          id: data.id,
          userId: recordData.userId,
          username: data.username,
          avatarUrl: data.avatar_url,
          trackId: data.track_id,
          trackTitle: data.track_title,
          score: data.score,
          accuracy: data.accuracy,
          maxCombo: data.max_combo,
          rank: data.rank,
          timestamp: new Date(data.created_at).getTime(),
        };
      }
    } catch (err) {
      console.warn('Supabase savePlayRecord error:', err);
    }

    return savedLocal;
  }

  public async getLeaderboard(
    trackId?: string,
    limit: number = 20
  ): Promise<LeaderboardEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getLeaderboard(trackId, limit);
    }

    try {
      let query = supabase
        .from('play_records')
        .select('*')
        .order('score', { ascending: false })
        .order('accuracy', { ascending: false })
        .limit(limit);

      if (trackId && trackId !== 'all') {
        query = query.eq('track_id', trackId);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        // Fall back to local records if table empty or query fails
        return this.localFallback.getLeaderboard(trackId, limit);
      }

      return data.map((item: any) => ({
        id: item.id,
        userId: item.user_id || 'player',
        username: item.username,
        avatarUrl: item.avatar_url,
        trackId: item.track_id,
        trackTitle: item.track_title,
        score: item.score,
        accuracy: item.accuracy,
        maxCombo: item.max_combo,
        rank: item.rank,
        timestamp: new Date(item.created_at).getTime(),
      }));
    } catch (err) {
      console.warn('Supabase getLeaderboard fallback to local:', err);
      return this.localFallback.getLeaderboard(trackId, limit);
    }
  }

  public async getPersonalBest(
    userId: string,
    trackId: string
  ): Promise<PersonalBest | null> {
    const all = await this.getAllPersonalBests(userId);
    return all[trackId] ?? null;
  }

  public async getAllPersonalBests(
    userId: string
  ): Promise<Record<string, PersonalBest>> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getAllPersonalBests(userId);
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid) {
        return this.localFallback.getAllPersonalBests(userId);
      }

      const { data, error } = await supabase
        .from('play_records')
        .select('*')
        .eq('user_id', userId)
        .order('score', { ascending: false });

      if (error || !data || data.length === 0) {
        return this.localFallback.getAllPersonalBests(userId);
      }

      const bests: Record<string, PersonalBest> = {};
      for (const rec of data) {
        if (!bests[rec.track_id] || rec.score > bests[rec.track_id].highScore) {
          bests[rec.track_id] = {
            trackId: rec.track_id,
            highScore: rec.score,
            accuracy: rec.accuracy,
            maxCombo: rec.max_combo,
            rank: rec.rank,
            updatedAt: new Date(rec.created_at).getTime(),
          };
        }
      }
      return bests;
    } catch {
      return this.localFallback.getAllPersonalBests(userId);
    }
  }

  public async getUserHistory(userId: string): Promise<PlayRecord[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getUserHistory(userId);
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid) {
        return this.localFallback.getUserHistory(userId);
      }

      const { data, error } = await supabase
        .from('play_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.localFallback.getUserHistory(userId);
      }

      return data.map((item: any) => ({
        id: item.id,
        userId: item.user_id || userId,
        username: item.username,
        avatarUrl: item.avatar_url,
        trackId: item.track_id,
        trackTitle: item.track_title,
        score: item.score,
        accuracy: item.accuracy,
        maxCombo: item.max_combo,
        rank: item.rank,
        timestamp: new Date(item.created_at).getTime(),
      }));
    } catch {
      return this.localFallback.getUserHistory(userId);
    }
  }
}
