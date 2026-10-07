import { DrumKitPreset, DrumType, RecordedHit, UserRecording } from '../types';
import { getSupabaseClient } from './supabase';

const GLOBAL_GUEST_KEY = 'virtual_drum_saved_recordings_guest';
const USER_KEY_PREFIX = 'virtual_drum_saved_recordings_';
const LEGACY_STORAGE_KEY = 'virtual_drum_saved_recordings';

// Initial default recordings to demonstrate the library for guests or demo audition
export const SEED_RECORDINGS: UserRecording[] = [
  {
    id: 'demo-rock-groove',
    title: 'Garage Rock Drive',
    authorName: 'Antigravity Studio',
    preset: 'rock',
    bpm: 100,
    durationMs: 4800,
    createdAt: Date.now() - 3600000 * 24 * 2,
    stats: {
      totalHits: 16,
      drumCounts: { kick: 4, snare: 4, hihat: 8, tom: 0, crash: 0 },
    },
    hits: [
      { id: 'h1', drum: 'kick', timestampMs: 0, velocity: 1.0 },
      { id: 'h2', drum: 'hihat', timestampMs: 300, velocity: 0.75 },
      { id: 'h3', drum: 'snare', timestampMs: 600, velocity: 0.95 },
      { id: 'h4', drum: 'hihat', timestampMs: 900, velocity: 0.75 },
      { id: 'h5', drum: 'kick', timestampMs: 1200, velocity: 1.0 },
      { id: 'h6', drum: 'kick', timestampMs: 1500, velocity: 0.85 },
      { id: 'h7', drum: 'snare', timestampMs: 1800, velocity: 0.95 },
      { id: 'h8', drum: 'hihat', timestampMs: 2100, velocity: 0.75 },
      { id: 'h9', drum: 'kick', timestampMs: 2400, velocity: 1.0 },
      { id: 'h10', drum: 'hihat', timestampMs: 2700, velocity: 0.75 },
      { id: 'h11', drum: 'snare', timestampMs: 3000, velocity: 0.95 },
      { id: 'h12', drum: 'hihat', timestampMs: 3300, velocity: 0.75 },
      { id: 'h13', drum: 'kick', timestampMs: 3600, velocity: 1.0 },
      { id: 'h14', drum: 'tom', timestampMs: 3900, velocity: 0.9 },
      { id: 'h15', drum: 'snare', timestampMs: 4200, velocity: 1.0 },
      { id: 'h16', drum: 'crash', timestampMs: 4500, velocity: 1.1 },
    ],
  },
  {
    id: 'demo-funk-pocket',
    title: 'Funky Pocket Jam',
    authorName: 'Groove Master',
    preset: 'acoustic',
    bpm: 115,
    durationMs: 4200,
    createdAt: Date.now() - 3600000 * 5,
    stats: {
      totalHits: 14,
      drumCounts: { kick: 5, snare: 3, hihat: 4, tom: 1, crash: 1 },
    },
    hits: [
      { id: 'f1', drum: 'kick', timestampMs: 0, velocity: 1.0 },
      { id: 'f2', drum: 'hihat', timestampMs: 260, velocity: 0.7 },
      { id: 'f3', drum: 'snare', timestampMs: 520, velocity: 0.9 },
      { id: 'f4', drum: 'kick', timestampMs: 780, velocity: 0.8 },
      { id: 'f5', drum: 'kick', timestampMs: 1040, velocity: 0.9 },
      { id: 'f6', drum: 'hihat', timestampMs: 1300, velocity: 0.75 },
      { id: 'f7', drum: 'snare', timestampMs: 1560, velocity: 0.95 },
      { id: 'f8', drum: 'tom', timestampMs: 2080, velocity: 0.85 },
      { id: 'f9', drum: 'kick', timestampMs: 2600, velocity: 1.0 },
      { id: 'f10', drum: 'hihat', timestampMs: 2860, velocity: 0.7 },
      { id: 'f11', drum: 'snare', timestampMs: 3120, velocity: 0.9 },
      { id: 'f12', drum: 'hihat', timestampMs: 3380, velocity: 0.7 },
      { id: 'f13', drum: 'kick', timestampMs: 3640, velocity: 0.95 },
      { id: 'f14', drum: 'crash', timestampMs: 3900, velocity: 1.05 },
    ],
  },
];

class RecordingsStorageService {
  /**
   * Resolve storage key scoped to a specific user account ID
   */
  private getStorageKey(userId?: string): string {
    if (userId && !userId.startsWith('guest-')) {
      return `${USER_KEY_PREFIX}${userId}`;
    }
    return GLOBAL_GUEST_KEY;
  }

  /**
   * Get saved recordings for a specific user, sorted by most recent first.
   * If userId is provided, returns ONLY that user's recordings.
   */
  public getRecordings(userId?: string): UserRecording[] {
    const key = this.getStorageKey(userId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => b.createdAt - a.createdAt);
        }
      }

      // If user has no scoped key yet, check legacy storage key to migrate existing records
      if (userId && !userId.startsWith('guest-')) {
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          try {
            const legacyParsed = JSON.parse(legacyRaw);
            if (Array.isArray(legacyParsed)) {
              const matched = legacyParsed.filter((r) => r.userId === userId);
              if (matched.length > 0) {
                this.saveRecordingsToLocal(matched, userId);
                return matched.sort((a, b) => b.createdAt - a.createdAt);
              }
            }
          } catch {
            // Ignore legacy parse errors
          }
        }
        // Account has no saved recordings yet
        return [];
      }

      // For unauthenticated guest mode: load default seed demo tracks
      this.saveRecordingsToLocal(SEED_RECORDINGS);
      return SEED_RECORDINGS;
    } catch (e) {
      console.warn('Failed to load recordings from localStorage:', e);
      return userId && !userId.startsWith('guest-') ? [] : SEED_RECORDINGS;
    }
  }

  /**
   * Save a new recording for a specific user account
   */
  public saveRecording(
    title: string,
    hits: RecordedHit[],
    durationMs: number,
    preset: DrumKitPreset = 'acoustic',
    authorName: string = 'Drummer Pro',
    userId?: string
  ): UserRecording {
    const drumCounts: Record<DrumType, number> = {
      kick: 0,
      snare: 0,
      hihat: 0,
      tom: 0,
      crash: 0,
    };
    for (const h of hits) {
      drumCounts[h.drum] = (drumCounts[h.drum] || 0) + 1;
    }

    const newRec: UserRecording = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || `Drum Jam #${new Date().toLocaleDateString('en-US')}`,
      authorName,
      userId,
      hits: [...hits].sort((a, b) => a.timestampMs - b.timestampMs),
      durationMs: Math.max(800, durationMs),
      preset,
      createdAt: Date.now(),
      stats: {
        totalHits: hits.length,
        drumCounts,
      },
    };

    const current = this.getRecordings(userId);
    const updated = [newRec, ...current];
    this.saveRecordingsToLocal(updated, userId);

    // Sync to Supabase cloud table if configured and userId is a valid UUID
    if (userId && !userId.startsWith('guest-')) {
      this.syncInsertToSupabase(newRec, userId);
    }

    return newRec;
  }

  /**
   * Delete a recording by ID for the specific account
   */
  public deleteRecording(id: string, userId?: string): void {
    const current = this.getRecordings(userId);
    const updated = current.filter((r) => r.id !== id);
    this.saveRecordingsToLocal(updated, userId);

    if (userId && !userId.startsWith('guest-')) {
      this.syncDeleteFromSupabase(id, userId);
    }
  }

  /**
   * Update title of a recording for the specific account
   */
  public renameRecording(id: string, newTitle: string, userId?: string): UserRecording | null {
    const current = this.getRecordings(userId);
    const target = current.find((r) => r.id === id);
    if (!target) return null;

    target.title = newTitle.trim() || target.title;
    this.saveRecordingsToLocal(current, userId);

    if (userId && !userId.startsWith('guest-')) {
      this.syncRenameToSupabase(id, target.title, userId);
    }

    return target;
  }

  /**
   * Import an external recording (from file or shared link) into user's account
   */
  public importRecording(recording: UserRecording, userId?: string): UserRecording {
    const current = this.getRecordings(userId);
    const safeRec: UserRecording = {
      ...recording,
      id: `rec-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      createdAt: Date.now(),
    };
    const updated = [safeRec, ...current];
    this.saveRecordingsToLocal(updated, userId);

    if (userId && !userId.startsWith('guest-')) {
      this.syncInsertToSupabase(safeRec, userId);
    }

    return safeRec;
  }

  private async syncInsertToSupabase(rec: UserRecording, userId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const supabase = getSupabaseClient();
    if (!supabase || !isUuid) return;
    try {
      await supabase.from('user_recordings').insert({
        id: rec.id,
        user_id: userId,
        title: rec.title,
        author_name: rec.authorName || 'Drummer',
        preset: rec.preset,
        duration_ms: rec.durationMs,
        hits: rec.hits,
        stats: rec.stats,
      });
    } catch {
      // Table may not exist yet, local fallback is safe
    }
  }

  private async syncDeleteFromSupabase(id: string, userId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const supabase = getSupabaseClient();
    if (!supabase || !isUuid) return;
    try {
      await supabase.from('user_recordings').delete().match({ id, user_id: userId });
    } catch {
      // Ignore
    }
  }

  private async syncRenameToSupabase(id: string, newTitle: string, userId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const supabase = getSupabaseClient();
    if (!supabase || !isUuid) return;
    try {
      await supabase.from('user_recordings').update({ title: newTitle }).match({ id, user_id: userId });
    } catch {
      // Ignore
    }
  }

  /**
   * Helper to load demo sample recordings into a user account if requested
   */
  public loadDemoRecordingsForUser(userId: string): UserRecording[] {
    const current = this.getRecordings(userId);
    const newDemos: UserRecording[] = SEED_RECORDINGS.map((demo) => ({
      ...demo,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      createdAt: Date.now(),
    }));
    const updated = [...newDemos, ...current];
    this.saveRecordingsToLocal(updated, userId);
    return updated;
  }

  private saveRecordingsToLocal(recordings: UserRecording[], userId?: string) {
    const key = this.getStorageKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(recordings));
    } catch (e) {
      console.warn('Failed to save recordings to localStorage:', e);
    }
  }
}

export const recordingsStorage = new RecordingsStorageService();
