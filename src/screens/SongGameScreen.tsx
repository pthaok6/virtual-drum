import { SongStructure } from '../components/SongPresentation';
import { formatSongTime } from '../services/songExperience';
import { musicSource } from '../services/songLibrary';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, Volume2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import type { AppSettings, DrumType, GameResult, HitRating, RhythmChallenge, ScreenType } from '../types';
import { DRUMS } from '../data/drums';
import { audioEngine } from '../services/audio';
import { cameraTracker, type TrackingState } from '../services/cameraTracker';
import { createSongState, expireSongNotes, hitSongNote, songResult } from '../services/rhythm';
import { BeatTimeline } from '../components/BeatTimeline';
import { CameraView } from '../components/CameraView';
import { DrumPad } from '../components/DrumPad';
import { Button } from '../components/ui/button';

export function SongGameScreen({ challenge, settings, onFinishGame, onNavigate }: {
  challenge: RhythmChallenge; settings: AppSettings; onFinishGame: (result: GameResult) => void; onNavigate: (screen: ScreenType) => void;
}) {
  const { t, locale } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const statsRef = useRef(createSongState(challenge.notes));
  const finishedRef = useRef(false);
  const [stats, setStats] = useState(statsRef.current);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ drum: DrumType; rating: HitRating; combo: number } | null>(null);
  const [activeHits, setActiveHits] = useState<Record<DrumType, { isHit: boolean; rating?: HitRating }>>({ hihat: { isHit: false }, tom: { isHit: false }, crash: { isHit: false }, snare: { isHit: false }, kick: { isHit: false } });
  const [tracking, setTracking] = useState<TrackingState>({ isStreaming: false, isInitializing: false, permissionGranted: false, error: null, leftHand: { x: 30, y: 50, isActive: false }, rightHand: { x: 70, y: 50, isActive: false }, zoneEnergies: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 } });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    audioRef.current?.pause();
    setPlaying(false);
    onFinishGame(songResult(challenge, statsRef.current));
  }, [challenge, onFinishGame]);
  const hit = useCallback((drum: DrumType) => {
    const audio = audioRef.current;
    if (!audio || audio.paused || finishedRef.current || audio.currentTime * 1000 < (challenge.music?.introMs ?? 0)) return;
    const result = hitSongNote(statsRef.current, drum, audio.currentTime * 1000);
    statsRef.current = result.state;
    setStats(result.state);
    if (settings.sfxEnabled) { audioEngine.playDrum(drum); audioEngine.playHitSound(result.rating); }
    setFeedback({ drum, rating: result.rating, combo: result.state.combo });
    setActiveHits(previous => ({ ...previous, [drum]: { isHit: true, rating: result.rating } }));
    timers.current.push(setTimeout(() => setActiveHits(previous => ({ ...previous, [drum]: { isHit: false } })), 180));
  }, [challenge, settings.sfxEnabled]);
  useEffect(() => cameraTracker.subscribeState(state => setTracking({ ...state })), []);
  useEffect(() => cameraTracker.subscribeHit(hit), [hit]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]'))) return;
      const drum = DRUMS.find(item => item.key === event.key.toUpperCase() || item.id === 'kick' && event.code === 'Space');
      if (drum) { event.preventDefault(); hit(drum.id); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [hit]);
  useEffect(() => {
    if (!playing) return;
    let frame: number;
    const update = () => {
      const audio = audioRef.current;
      if (!audio || finishedRef.current) return;
      const now = audio.currentTime * 1000;
      setTimeMs(now);
      const next = expireSongNotes(statsRef.current, now);
      if (next !== statsRef.current) { statsRef.current = next; setStats(next); }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => { if (audioRef.current) { audioRef.current.volume = settings.volume * 0.65; audioRef.current.muted = !musicEnabled; } }, [settings.volume, musicEnabled]);
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); timers.current.forEach(clearTimeout); };
  }, []);
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    try { await audioEngine.unlock(); await audio.play(); setStarted(true); setError(''); }
    catch { setError('Could not play the song. Try starting it again.'); }
  };
  const upcoming = stats.notes.find(note => !note.hit);
  const processed = stats.notes.filter(note => note.hit).length;
  const count = Math.max(1, Math.ceil(((challenge.music?.introMs ?? 0) - timeMs) / 600));
  return <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
    <audio ref={audioRef} src={musicSource(challenge.music!.src, import.meta.env?.BASE_URL ?? '/')} preload="auto" onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={finish} onError={() => setError('Could not play the song. Try starting it again.')} />
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => { audioRef.current?.pause(); onNavigate('challenge-select'); }} aria-label={t('Abort')}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-xl font-bold text-white">{challenge.title}</h1><p className="text-xs text-zinc-400">{t('Song challenge')} · {challenge.bpm} BPM · {t(challenge.difficulty)} · {processed}/{challenge.notes.length}</p></div></div>
      <div className="flex gap-5 text-sm"><div><p className="text-zinc-500">{t('Score')}</p><strong className="font-mono text-amber-300">{stats.score.toLocaleString(locale)}</strong></div><div><p className="text-zinc-500">{t('Combo')}</p><strong>{stats.combo}</strong></div><div><p className="text-zinc-500">{t('Misses')}</p><strong className="text-rose-300">{stats.misses}</strong></div></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div><h2 className="font-bold text-white">{!started ? t('Get Ready') : playing && timeMs < challenge.music!.introMs ? count : t('Hit the drums when the notes reach the glowing line.')}</h2><p className="mt-1 text-xs text-zinc-400">{t('The song keeps playing. Missed notes advance automatically.')}</p></div>
      <div className="flex gap-2"><Button onClick={togglePlayback} className="bg-rose-500 text-white hover:bg-rose-600">{playing ? <Pause /> : <Play />}{playing ? t('Pause') : started ? t('Resume song') : t('Start song')}</Button><Button variant="outline" onClick={() => setMusicEnabled(!musicEnabled)} aria-pressed={musicEnabled}><Volume2 />{t(musicEnabled ? 'Music on' : 'Music off')}</Button></div>
    </div>
    {error && <p role="alert" className="text-sm text-rose-300">{t(error)}</p>}
    {challenge.song?.chartSource === 'demo' && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{t('Demo chart: BPM, sections, and drum notes are illustrative. Automatic music analysis is not connected.')}</p>}
    <div className="flex items-center justify-between text-xs text-zinc-500"><span>{formatSongTime(timeMs / 1000)} / {formatSongTime(challenge.durationSeconds)}</span><span>{t('Feel the song')}</span></div>
    <BeatTimeline notes={stats.notes} currentTimeMs={timeMs} bpm={challenge.bpm} lastHitFeedback={feedback} />
    {challenge.song && <SongStructure sections={challenge.song.sections} currentMs={timeMs} />}
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <CameraView isCameraActive={tracking.isStreaming} isCameraInitializing={tracking.isInitializing} cameraError={tracking.error} onToggleCamera={() => { if (tracking.isStreaming) cameraTracker.stop(); else void cameraTracker.start(undefined, settings.selectedCameraId); }} leftHand={tracking.leftHand} rightHand={tracking.rightHand} zoneEnergies={tracking.zoneEnergies} activeHits={activeHits} onDrumClick={hit} promptedDrum={upcoming && Math.abs(upcoming.timeMs - timeMs) < 500 ? upcoming.drum : null} mirror={settings.mirrorCamera} showHandIndicators={settings.showHandIndicators} />
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3 py-10">{DRUMS.map(drum => <DrumPad key={drum.id} drum={drum} isHit={activeHits[drum.id].isHit} hitRating={activeHits[drum.id].rating} onClick={() => hit(drum.id)} size="sm" />)}</div>
    </div>
  </div>;
}
