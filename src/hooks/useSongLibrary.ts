import { useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../data/challenges';
import type { RhythmChallenge } from '../types';
import { buildCustomChallenge, deleteSong as deleteStoredSong, loadSavedSongs, saveSong, type SavedSong } from '../services/songLibrary';

export function useSongLibrary() {
  const [customSongs, setCustomSongs] = useState<RhythmChallenge[]>([]);
  const [storageMessage, setStorageMessage] = useState('');
  const urls = useRef<string[]>([]);
  useEffect(() => {
    let canceled = false;
    void loadSavedSongs().then(songs => {
      if (canceled) return;
      const restored: RhythmChallenge[] = [];
      for (const song of songs) {
        let url: string | undefined;
        try {
          url = URL.createObjectURL(song.file);
          restored.push(buildCustomChallenge(song, url));
          urls.current.push(url);
        } catch { if (url) URL.revokeObjectURL(url); }
      }
      setCustomSongs(previous => [...previous, ...restored.filter(song => !previous.some(entry => entry.id === song.id))]);
    }).catch(() => {});
    return () => { canceled = true; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; };
  }, []);
  const addSong = async (song: SavedSong) => {
    const url = URL.createObjectURL(song.file);
    let challenge: RhythmChallenge;
    try { challenge = buildCustomChallenge(song, url); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
    urls.current.push(url);
    setCustomSongs(previous => [...previous, challenge]);
    try { await saveSong(song); setStorageMessage(''); }
    catch { setStorageMessage('Song added for this session, but browser storage could not save it.'); }
    return challenge;
  };
  const removeSong = async (id: string) => {
    await deleteStoredSong(id);
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
