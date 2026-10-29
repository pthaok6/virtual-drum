import { useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../data/challenges';
import type { RhythmChallenge } from '../types';
import { buildCustomChallenge, deleteSong as deleteStoredSong, loadSavedSongs, saveSong, type SavedSong } from '../services/songLibrary';
import { uploadSongToSupabase, fetchRemoteSongs, deleteRemoteSong } from '../services/songStorage';

export function useSongLibrary(userId?: string | null) {
  const [customSongs, setCustomSongs] = useState<RhythmChallenge[]>([]);
  const [storageMessage, setStorageMessage] = useState('');
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let canceled = false;

    const loadAll = async () => {
      // 1. Load from IndexedDB
      try {
        const localSongs = await loadSavedSongs();
        if (canceled) return;
        const restored: RhythmChallenge[] = [];
        for (const song of localSongs) {
          let url: string | undefined;
          try {
            url = URL.createObjectURL(song.file);
            restored.push(buildCustomChallenge(song, url));
            urls.current.push(url);
          } catch {
            if (url) URL.revokeObjectURL(url);
          }
        }
        setCustomSongs(previous => [
          ...previous,
          ...restored.filter(song => !previous.some(entry => entry.id === song.id))
        ]);
      } catch {
        // IndexedDB unavailable or empty
      }

      // 2. Load from Supabase
      try {
        const remoteSongs = await fetchRemoteSongs();
        if (canceled) return;
        const remoteChallenges: RhythmChallenge[] = [];
        for (const r of remoteSongs) {
          try {
            const challenge = buildCustomChallenge({
              id: r.id,
              title: r.title,
              bpm: r.bpm,
              durationSeconds: r.duration_seconds,
              startSeconds: r.start_seconds,
              difficulty: r.difficulty,
              demoAnalysis: r.demo_analysis,
              beatTimes: r.beat_times,
              analysisNotes: r.analysis_notes,
            }, r.audio_url);
            remoteChallenges.push(challenge);
          } catch (e) {
            console.warn('Failed to build challenge from remote song:', r.id, e);
          }
        }

        setCustomSongs(previous => {
          const existingIds = new Set(previous.map(s => s.id));
          const newOnes = remoteChallenges.filter(s => !existingIds.has(s.id));
          return [...previous, ...newOnes];
        });
      } catch (err) {
        console.warn('Supabase remote songs loading error:', err);
      }
    };

    void loadAll();

    return () => {
      canceled = true;
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current = [];
    };
  }, [userId]);

  const addSong = async (song: SavedSong) => {
    const url = URL.createObjectURL(song.file);
    let challenge: RhythmChallenge;
    try {
      challenge = buildCustomChallenge(song, url);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    urls.current.push(url);
    setCustomSongs(previous => [...previous.filter(s => s.id !== challenge.id), challenge]);

    try {
      await saveSong(song);
      setStorageMessage('');
    } catch {
      setStorageMessage('Song added for this session, but browser storage could not save it.');
    }

    // Also upload to Supabase in the background
    void uploadSongToSupabase(song, userId).catch(err => {
      console.warn('Cloud sync error for song:', err);
    });

    return challenge;
  };

  const removeSong = async (id: string) => {
    try {
      await deleteStoredSong(id);
    } catch {}
    void deleteRemoteSong(id, userId);

    const challenge = customSongs.find(song => song.id === id);
    if (challenge?.music?.src.startsWith('blob:')) {
      URL.revokeObjectURL(challenge.music.src);
      urls.current = urls.current.filter(url => url !== challenge.music?.src);
    }
    setCustomSongs(previous => previous.filter(song => song.id !== id));
    setStorageMessage('');
  };

  const challenges = useMemo(() => [...CHALLENGES, ...customSongs], [customSongs]);
  return { challenges, addSong, removeSong, storageMessage };
}
