import { SongStructure } from '../components/SongPresentation';
import { chooseSongDifficulty, formatSongTime } from '../services/songExperience';
import { musicSource } from '../services/songLibrary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, ShieldAlert, Volume2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import type { AppSettings, DrumType, GameResult, HitRating, RhythmChallenge, ScreenType } from '../types';
import { DRUMS } from '../data/drums';
import { audioEngine } from '../services/audio';
import { cameraTracker, type TrackingState } from '../services/cameraTracker';
import { createSongState, expireSongNotes, hitSongNote, songAccuracy, songResult, TIMING_WINDOWS } from '../services/rhythm';
import { NoteHighway } from '../components/NoteHighway';
import { DrumKitSelector } from '../components/DrumKitSelector';
import { CameraView } from '../components/CameraView';
import { DrumPad } from '../components/DrumPad';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { useAuth } from '../context/AuthContext';
import { useMultiplayerGame, CoopHitEvent } from '../hooks/useMultiplayerGame';
import { MultiplayerHUD } from '../components/MultiplayerHUD';
import { OpponentGameplayView } from '../components/OpponentGameplayView';

export function SongGameScreen({
  challenge: sourceChallenge,
  settings,
  onFinishGame,
  onNavigate,
  roomSession,
}: {
  challenge: RhythmChallenge;
  settings: AppSettings;
  onFinishGame: (
    result: GameResult,
    opponentResult?: { name: string; score: number; accuracy: number; combo: number } | null
  ) => void;
  onNavigate: (screen: ScreenType) => void;
  roomSession?: {
    roomName: string;
    mode: 'versus' | 'together';
    roomId?: string;
    players?: { id: string; name: string; isHost?: boolean }[];
    isHost?: boolean;
  } | null;
}) {
  const challenge = useMemo(() => chooseSongDifficulty(sourceChallenge, sourceChallenge.difficulty), [sourceChallenge]);
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const currentUserId = profile?.id || 'you';
  const currentUserName = profile?.displayName || 'You';

  const audioRef = useRef<HTMLAudioElement>(null);
  const statsRef = useRef(createSongState(challenge.notes, challenge));
  const finishedRef = useRef(false);
  const [stats, setStats] = useState(statsRef.current);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ drum: DrumType; rating: HitRating; combo: number } | null>(null);
  const [activeHits, setActiveHits] = useState<Record<DrumType, { isHit: boolean; rating?: HitRating }>>({
    hihat: { isHit: false },
    tom: { isHit: false },
    crash: { isHit: false },
    snare: { isHit: false },
    kick: { isHit: false },
  });
  const [tracking, setTracking] = useState<TrackingState>({
    isStreaming: false,
    isInitializing: false,
    permissionGranted: false,
    error: null,
    leftHand: { x: 30, y: 50, isActive: false },
    rightHand: { x: 70, y: 50, isActive: false },
    zoneEnergies: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 },
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isTogetherMode = roomSession?.mode === 'together';
  const isVersusMode = roomSession?.mode === 'versus';
  const isHost = roomSession?.isHost ?? true;

  const processedCount = stats.notes.filter((note) => note.hit).length;
  const turnIndex = Math.floor(processedCount / 10);
  const isHostTurn = turnIndex % 2 === 0;
  const isMyTurn = !isTogetherMode || (isHost ? isHostTurn : !isHostTurn);
  const notesInTurn = processedCount % 10;
  const notesRemainingInTurn = 10 - notesInTurn;

  const opponentPlayer = roomSession?.players?.find((p) => p.id !== currentUserId);
  const activePlayerName = isMyTurn ? currentUserName : (opponentPlayer?.name || t("Partner"));

  const [lastRemoteHit, setLastRemoteHit] = useState<{ drum: DrumType; rating: HitRating } | null>(null);

  const handleRemoteCoopHit = useCallback((event: CoopHitEvent) => {
    setLastRemoteHit({ drum: event.drum, rating: event.rating });
    setActiveHits((previous) => ({ ...previous, [event.drum]: { isHit: true, rating: event.rating } }));
    timers.current.push(setTimeout(() => setActiveHits((previous) => ({ ...previous, [event.drum]: { isHit: false } })), 180));

    setStats((prevStats) => {
      const unhitIndex = prevStats.notes.findIndex((n) => !n.hit && n.drum === event.drum);
      let updatedNotes = prevStats.notes;
      if (unhitIndex !== -1) {
        updatedNotes = prevStats.notes.map((n, i) => (i === unhitIndex ? { ...n, hit: true, hitRating: event.rating } : n));
      }
      const next = {
        ...prevStats,
        notes: updatedNotes,
        score: event.teamScore,
        combo: event.teamCombo,
        maxCombo: Math.max(prevStats.maxCombo, event.teamCombo),
      };
      statsRef.current = next;
      return next;
    });
  }, []);

  const { opponent, partnerDisconnected, sendVersusProgress, sendCoopHit, sendLeaveMatch } = useMultiplayerGame({
    roomId: roomSession?.roomId,
    mode: roomSession?.mode,
    currentUserId,
    currentUserName,
    players: roomSession?.players,
    onRemoteCoopHit: handleRemoteCoopHit,
  });

  // Cleanup: notify server when leaving mid-game
  useEffect(() => {
    return () => {
      if (roomSession?.roomId) sendLeaveMatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    audioRef.current?.pause();
    setPlaying(false);
    const finalResult = songResult(challenge, statsRef.current);
    if (isVersusMode) {
      sendVersusProgress({
        score: finalResult.score,
        combo: finalResult.maxCombo,
        accuracy: finalResult.accuracy,
        currentNoteIndex: challenge.notes.length,
        totalNotes: challenge.notes.length,
        finished: true,
      });
    }
    const oppResult =
      isVersusMode && opponent
        ? {
            name: opponent.name || opponentPlayer?.name || 'Opponent',
            score: opponent.score,
            accuracy: opponent.accuracy,
            combo: opponent.combo,
          }
        : null;
    onFinishGame(finalResult, oppResult);
  }, [challenge, onFinishGame, isVersusMode, sendVersusProgress, opponent, opponentPlayer]);

  const hit = useCallback((drum: DrumType) => {
    const audio = audioRef.current;
    if (!audio || audio.paused || finishedRef.current) return;

    // Together mode: lock input when partner is playing
    if (isTogetherMode && !isMyTurn) return;

    const result = hitSongNote(statsRef.current, drum, audio.currentTime * 1000);
    statsRef.current = result.state;
    setStats(result.state);
    if (settings.sfxEnabled) {
      audioEngine.playDrum(drum);
      if (result.rating === 'miss') audioEngine.playHitSound('miss');
    }
    setFeedback({ drum, rating: result.rating, combo: result.state.combo });
    setActiveHits((previous) => ({ ...previous, [drum]: { isHit: true, rating: result.rating } }));
    timers.current.push(setTimeout(() => setActiveHits((previous) => ({ ...previous, [drum]: { isHit: false } })), 180));

    const currentProcessed = result.state.notes.filter((n) => n.hit).length;
    if (isTogetherMode) {
      sendCoopHit({
        drum,
        rating: result.rating,
        noteIndex: currentProcessed,
        teamScore: result.state.score,
        teamCombo: result.state.combo,
      });
    } else if (isVersusMode) {
      sendVersusProgress({
        score: result.state.score,
        combo: result.state.combo,
        accuracy: songAccuracy(result.state),
        currentNoteIndex: currentProcessed,
        totalNotes: challenge.notes.length,
        lastHit: { drum, rating: result.rating },
        activeHits: { ...activeHits, [drum]: { isHit: true, rating: result.rating } },
        finished: false,
      });
    }
  }, [challenge, settings.sfxEnabled, isTogetherMode, isMyTurn, isVersusMode, sendCoopHit, sendVersusProgress, activeHits]);

  useEffect(() => cameraTracker.subscribeState((state) => setTracking({ ...state })), []);
  useEffect(() => cameraTracker.subscribeHit(hit), [hit]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]'))) return;
      const drum = DRUMS.find((item) => item.key === event.key.toUpperCase() || (item.id === 'kick' && event.code === 'Space'));
      if (drum) {
        event.preventDefault();
        hit(drum.id);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [hit]);

  useEffect(() => {
    if (!playing) return;
    let frame: number;
    let lastUiUpdate = 0;
    const update = (frameTime: number) => {
      if (frameTime - lastUiUpdate >= 1000 / 30) {
        lastUiUpdate = frameTime;
        const audio = audioRef.current;
        if (!audio || finishedRef.current) return;
        const now = audio.currentTime * 1000;
        setTimeMs(now);
        const next = expireSongNotes(statsRef.current, now);
        if (next !== statsRef.current) {
          statsRef.current = next;
          setStats(next);
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
      audioRef.current.muted = !musicEnabled;
    }
  }, [musicVolume, musicEnabled]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = challenge.playbackRate ?? 1;
  }, [challenge.playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audioEngine.unlock();
      await audio.play();
      setStarted(true);
      setError('');
    } catch {
      setError('Could not play the song. Try starting it again.');
    }
  };

  const upcoming = stats.notes.find((note) => !note.hit);
  const processed = stats.notes.filter((note) => note.hit).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <audio
        ref={audioRef}
        src={musicSource(challenge.music!.src, import.meta.env?.BASE_URL ?? '/')}
        preload="auto"
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={finish}
        onError={() => setError('Could not play the song. Try starting it again.')}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              audioRef.current?.pause();
              onNavigate('challenge-select');
            }}
            aria-label={t('Abort')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{challenge.title}</h1>
            <p className="text-xs text-zinc-400">
              {t('Song challenge')} · {challenge.bpm} BPM · {t(challenge.difficulty)} · {processed}/{challenge.notes.length}
            </p>
          </div>
        </div>
        <div className="flex gap-5 text-sm">
          <div>
            <p className="text-zinc-500">{t('Score')}</p>
            <strong className="font-mono text-amber-300">{stats.score.toLocaleString(locale)}</strong>
          </div>
          <div>
            <p className="text-zinc-500">{t('Combo')}</p>
            <strong>{stats.combo}</strong>
          </div>
          <div>
            <p className="text-zinc-500">{t('Misses')}</p>
            <strong className="text-rose-300">{stats.misses}</strong>
          </div>
        </div>
      </div>

      {roomSession && (
        <MultiplayerHUD
          mode={roomSession.mode}
          roomName={roomSession.roomName}
          myScore={stats.score}
          myCombo={stats.combo}
          opponent={opponent}
          opponentName={opponentPlayer?.name}
          currentNoteIndex={processedCount}
          isMyTurn={isMyTurn}
          activePlayerName={activePlayerName}
          notesRemainingInTurn={notesRemainingInTurn}
          teamScore={stats.score}
          teamCombo={stats.combo}
          lastRemoteHit={lastRemoteHit}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <h2 className="font-bold text-white">
            {!started
              ? t('Get Ready')
              : isTogetherMode && !isMyTurn
                ? t("Input locked. Partner is playing now.")
                : t('Hit the drums when the notes reach the glowing line.')}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {isTogetherMode
              ? t("Players take turns every 10 notes. Listen to each other!")
              : t('The song keeps playing. Missed notes advance automatically.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={togglePlayback} className="bg-rose-500 text-white hover:bg-rose-600">
            {playing ? <Pause /> : <Play />}
            {playing ? t('Pause') : started ? t('Resume song') : t('Start song')}
          </Button>
          <Button variant="outline" onClick={() => setMusicEnabled(!musicEnabled)} aria-pressed={musicEnabled}>
            <Volume2 />
            {t(musicEnabled ? 'Music on' : 'Music off')}
          </Button>
          <label className="flex min-w-48 items-center gap-2 text-xs text-zinc-300">
            <span className="whitespace-nowrap">{t('Music volume')}</span>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[musicVolume]}
              onValueChange={(value) => setMusicVolume(Array.isArray(value) ? value[0] : value)}
              aria-label={t('Music volume')}
              className="w-24 cursor-pointer [&_[data-slot=slider-range]]:bg-sky-400 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-zinc-700"
            />
            <span className="w-9 text-right font-mono">{Math.round(musicVolume * 100)}%</span>
          </label>
          <DrumKitSelector compact />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{t(error)}</p>}
      {challenge.song?.chartSource === 'demo' && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t('Demo chart: BPM, sections, and drum notes are illustrative. Automatic music analysis is not connected.')}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {formatSongTime(timeMs / 1000)} / {formatSongTime(challenge.durationSeconds)}
        </span>
        <span>{t('Feel the song')}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs text-sky-200">
        <span className="font-semibold">{t('Hit window: ±{ms} ms', { ms: TIMING_WINDOWS[challenge.difficulty].goodMs })}</span>
        <span className="text-zinc-400">{t(challenge.difficulty === 'Easy' ? 'Fewer notes. More time to find your groove.' : 'Early and late hits count inside the highlighted band.')}</span>
      </div>

      <NoteHighway
        notes={stats.notes}
        currentTimeMs={timeMs}
        bpm={challenge.bpm}
        hitWindowMs={stats.timing.goodMs}
        lastHitFeedback={feedback}
        activeHits={activeHits}
        onDrumHit={hit}
      />

      {challenge.song && <SongStructure sections={challenge.song.sections} currentMs={timeMs} />}

      {/* Partner disconnected overlay (versus mode) */}
      {partnerDisconnected && isVersusMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-950 p-8 text-center max-w-sm mx-4 shadow-2xl">
            <ShieldAlert className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-xl font-black text-white mb-2">{t('Opponent disconnected')}</h2>
            <p className="text-sm text-zinc-400 mb-6">
              {t('Your opponent left the match. Finish your song to record your score!')}
            </p>
            <Button onClick={() => onNavigate('challenge-select')} variant="outline">
              {t('Back to challenges')}
            </Button>
          </div>
        </div>
      )}

      <div className={`grid gap-5 ${isVersusMode ? 'lg:grid-cols-[1.2fr_0.7fr_0.9fr]' : 'lg:grid-cols-[1.6fr_1fr]'}`}>
        <div className="relative">
          {isTogetherMode && !isMyTurn && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]">
              <div className="rounded-xl border border-amber-500/40 bg-zinc-950/90 px-4 py-2 text-center shadow-xl">
                <p className="text-sm font-bold text-amber-300">{t("Input locked. Partner is playing now.")}</p>
                <p className="text-xs text-zinc-400">
                  {t("{name}'s turn ({hit}/10 notes) · Listen to their beats!", {
                    name: activePlayerName,
                    hit: notesInTurn,
                  })}
                </p>
              </div>
            </div>
          )}
          <CameraView
            isCameraActive={tracking.isStreaming}
            isCameraInitializing={tracking.isInitializing}
            cameraError={tracking.error}
            onToggleCamera={() => {
              if (tracking.isStreaming) cameraTracker.stop();
              else void cameraTracker.start(undefined, settings.selectedCameraId);
            }}
            leftHand={tracking.leftHand}
            rightHand={tracking.rightHand}
            zoneEnergies={tracking.zoneEnergies}
            activeHits={activeHits}
            onDrumClick={hit}
            promptedDrum={upcoming && Math.abs(upcoming.timeMs - timeMs) < 500 ? upcoming.drum : null}
            mirror={settings.mirrorCamera}
            showHandIndicators={settings.showHandIndicators}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3 py-10">
          {DRUMS.map((drum) => (
            <DrumPad
              key={drum.id}
              drum={drum}
              isHit={activeHits[drum.id].isHit}
              hitRating={activeHits[drum.id].rating}
              onClick={() => hit(drum.id)}
              size="sm"
            />
          ))}
        </div>

        {/* Versus mode: live opponent gameplay view */}
        {isVersusMode && (
          <OpponentGameplayView
            opponent={opponent}
            opponentName={opponentPlayer?.name}
            myScore={stats.score}
            totalNotes={challenge.notes.length}
          />
        )}
      </div>
    </div>
  );
}
