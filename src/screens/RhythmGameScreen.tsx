import React, { useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  DrumType,
  GameResult,
  HitRating,
  RhythmChallenge,
  ScreenType,
} from '../types';
import { DRUMS } from '../data/drums';
import { CameraView } from '../components/CameraView';
import { DrumPad } from '../components/DrumPad';
import { cameraTracker, TrackingState } from '../services/cameraTracker';
import { audioEngine } from '../services/audio';
import { ArrowLeft, Flame, Target } from 'lucide-react';

interface RhythmGameScreenProps {
  challenge: RhythmChallenge;
  onFinishGame: (result: GameResult) => void;
  onNavigate: (screen: ScreenType) => void;
  settings: AppSettings;
}

interface ChallengeStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfectHits: number;
  goodHits: number;
  misses: number;
}

const EMPTY_HITS: Record<DrumType, { isHit: boolean; rating?: HitRating }> = {
  hihat: { isHit: false },
  tom: { isHit: false },
  crash: { isHit: false },
  snare: { isHit: false },
  kick: { isHit: false },
};

export const RhythmGameScreen: React.FC<RhythmGameScreenProps> = ({
  challenge,
  onFinishGame,
  onNavigate,
  settings,
}) => {
  const [countdown, setCountdown] = useState<number | null>(3);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [activeHits, setActiveHits] = useState(EMPTY_HITS);
  const [lastHitFeedback, setLastHitFeedback] = useState<{
    drum: DrumType;
    rating: HitRating;
  } | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isStreaming: false,
    isInitializing: false,
    permissionGranted: false,
    error: null,
    leftHand: { x: 30, y: 50, isActive: false },
    rightHand: { x: 70, y: 50, isActive: false },
    zoneEnergies: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 },
  });

  const noteIndexRef = useRef(0);
  const finishedRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef<ChallengeStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectHits: 0,
    goodHits: 0,
    misses: 0,
  });

  const totalNotes = challenge.notes.length;
  const currentNote = challenge.notes[currentNoteIndex] ?? null;
  const currentDrum = currentNote
    ? DRUMS.find((drum) => drum.id === currentNote.drum) ?? null
    : null;
  const progressPercent = totalNotes === 0
    ? 100
    : Math.min(100, (currentNoteIndex / totalNotes) * 100);
  const attempts = correctHits + mistakes;
  const accuracy = attempts === 0 ? 100 : Math.round((correctHits / attempts) * 1000) / 10;

  function finishChallenge(finalStats: ChallengeStats) {
    const totalProcessed = Math.max(1, finalStats.perfectHits + finalStats.misses);
    const finalAccuracy = Math.round((finalStats.perfectHits / totalProcessed) * 100);

    let stars = 1;
    let rank: GameResult['rank'] = 'C';
    if (finalAccuracy >= 95) {
      stars = 3;
      rank = 'S';
    } else if (finalAccuracy >= 85) {
      stars = 3;
      rank = 'A';
    } else if (finalAccuracy >= 70) {
      stars = 2;
      rank = 'B';
    } else if (finalAccuracy < 50) {
      stars = 0;
      rank = 'D';
    }

    const maxScore = challenge.notes.reduce(
      (total, _, index) => total + 300 * (index > 20 ? 3 : index > 10 ? 2 : 1),
      0
    );

    onFinishGame({
      challenge,
      score: finalStats.score,
      maxScore,
      accuracy: finalAccuracy,
      maxCombo: finalStats.maxCombo,
      perfectHits: finalStats.perfectHits,
      goodHits: 0,
      misses: finalStats.misses,
      stars,
      rank,
    });
  }

  function evaluateDrumHit(drum: DrumType) {
    if (finishedRef.current) return;

    if (settings.sfxEnabled) {
      audioEngine.playDrum(drum);
    }

    const noteIndex = noteIndexRef.current;
    const expectedNote = challenge.notes[noteIndex];
    if (!expectedNote) return;

    const isCorrect = expectedNote.drum === drum;
    const rating: HitRating = isCorrect ? 'perfect' : 'miss';

    if (isCorrect) {
      const currentStats = statsRef.current;
      const multiplier = currentStats.combo > 20 ? 3 : currentStats.combo > 10 ? 2 : 1;
      const nextCombo = currentStats.combo + 1;
      const nextStats: ChallengeStats = {
        ...currentStats,
        score: currentStats.score + 300 * multiplier,
        combo: nextCombo,
        maxCombo: Math.max(currentStats.maxCombo, nextCombo),
        perfectHits: currentStats.perfectHits + 1,
      };
      statsRef.current = nextStats;

      setScore(nextStats.score);
      setCombo(nextStats.combo);
      setMaxCombo(nextStats.maxCombo);
      setCorrectHits(nextStats.perfectHits);

      const nextIndex = noteIndex + 1;
      noteIndexRef.current = nextIndex;
      setCurrentNoteIndex(nextIndex);

      if (nextIndex >= totalNotes) {
        finishedRef.current = true;
        finishTimerRef.current = setTimeout(() => finishChallenge(nextStats), 350);
      }
    } else {
      const nextStats: ChallengeStats = {
        ...statsRef.current,
        combo: 0,
        misses: statsRef.current.misses + 1,
      };
      statsRef.current = nextStats;
      setCombo(0);
      setMistakes(nextStats.misses);
      audioEngine.playHitSound('miss');
    }

    setActiveHits((previous) => ({
      ...previous,
      [drum]: { isHit: true, rating },
    }));
    window.setTimeout(() => {
      setActiveHits((previous) => ({
        ...previous,
        [drum]: { isHit: false },
      }));
    }, 180);
    setLastHitFeedback({ drum, rating });
  }

  useEffect(() => {
    const unsubscribe = cameraTracker.subscribeState((state) => {
      setTrackingState({ ...state });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      audioEngine.playCountdownBeep(false);
      const timer = window.setTimeout(() => setCountdown(countdown - 1), 750);
      return () => window.clearTimeout(timer);
    }

    audioEngine.playCountdownBeep(true);
    const timer = window.setTimeout(() => setCountdown(null), 500);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const unsubscribe = cameraTracker.subscribeHit((drum) => {
      if (countdown === null) evaluateDrumHit(drum);
    });
    return unsubscribe;
  }, [countdown, settings.sfxEnabled, challenge]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || countdown !== null || finishedRef.current) return;
      const key = event.key.toUpperCase();
      const drum = DRUMS.find(
        (item) => item.key === key || (item.id === 'kick' && event.code === 'Space')
      );
      if (drum) evaluateDrumHit(drum.id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [countdown, settings.sfxEnabled, challenge]);

  useEffect(() => () => {
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
  }, []);

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-400 sm:text-base">
            Get Ready
          </div>
          <div className="bg-gradient-to-tr from-rose-500 to-amber-400 bg-clip-text text-8xl font-black text-transparent drop-shadow-2xl sm:text-9xl">
            {countdown === 0 ? 'GO!' : countdown}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Play the highlighted drum. The next step waits for you.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('challenge-select')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Abort</span>
          </button>
          <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-white sm:text-lg">
            <span>{challenge.title}</span>
            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-normal text-amber-400">
              Guided
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Score</span>
            <span className="font-mono text-base font-black text-white sm:text-lg">
              {score.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-400">
            <Flame className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-amber-500/80">Combo</span>
              <span className="font-mono text-sm font-black">{combo}</span>
            </div>
          </div>
          <div className="hidden flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 sm:flex">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Accuracy</span>
            <span className="font-mono text-sm font-black text-emerald-400">{accuracy}%</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-300">
            <Target className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-mono text-xs font-bold">
              {Math.min(currentNoteIndex + 1, totalNotes)}/{totalNotes}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-4">
        <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
          {currentDrum ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl border-2 text-lg font-black text-zinc-950 shadow-lg"
                  style={{
                    backgroundColor: currentDrum.color,
                    borderColor: '#ffffff',
                    boxShadow: `0 0 22px ${currentDrum.glowColor}`,
                  }}
                >
                  {currentDrum.key}
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Play this drum
                  </span>
                  <span className="text-xl font-black uppercase" style={{ color: currentDrum.color }}>
                    {currentDrum.name}
                  </span>
                  <p className="text-[11px] text-zinc-400">Waiting until you hit the correct drum</p>
                </div>
              </div>
              {lastHitFeedback && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                    lastHitFeedback.rating === 'perfect'
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {lastHitFeedback.rating === 'perfect' ? 'Correct' : 'Wrong drum'}
                </span>
              )}
            </>
          ) : (
            <div className="w-full text-center font-bold text-emerald-400">Challenge complete!</div>
          )}
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-8">
            <CameraView
              isCameraActive={trackingState.isStreaming}
              isCameraInitializing={trackingState.isInitializing}
              cameraError={trackingState.error}
              onToggleCamera={() => {
                if (trackingState.isStreaming) {
                  cameraTracker.stop();
                } else {
                  cameraTracker.start(undefined, settings.selectedCameraId);
                }
              }}
              leftHand={trackingState.leftHand}
              rightHand={trackingState.rightHand}
              zoneEnergies={trackingState.zoneEnergies}
              activeHits={activeHits}
              onDrumClick={evaluateDrumHit}
              promptedDrum={currentDrum?.id ?? null}
              mirror={settings.mirrorCamera}
              showHandIndicators={settings.showHandIndicators}
            />
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-4">
            <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Guided Drums</span>
              <span className="text-[10px] text-zinc-500">Tap / Camera</span>
            </div>

            <div className="grid grid-cols-2 justify-items-center gap-2">
              {(['snare', 'kick', 'hihat', 'crash'] as DrumType[]).map((drumId) => {
                const drum = DRUMS.find((item) => item.id === drumId)!;
                return (
                  <DrumPad
                    key={drum.id}
                    drum={drum}
                    isHit={activeHits[drum.id].isHit}
                    hitRating={activeHits[drum.id].rating}
                    isPrompted={currentDrum?.id === drum.id}
                    energyPercent={trackingState.zoneEnergies[drum.id]}
                    onClick={() => evaluateDrumHit(drum.id)}
                    size="sm"
                  />
                );
              })}
              <div className="col-span-2">
                <DrumPad
                  drum={DRUMS[1]}
                  isHit={activeHits.tom.isHit}
                  hitRating={activeHits.tom.rating}
                  isPrompted={currentDrum?.id === 'tom'}
                  energyPercent={trackingState.zoneEnergies.tom}
                  onClick={() => evaluateDrumHit('tom')}
                  size="sm"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-800 pt-2 text-center">
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-1">
                <span className="block text-[9px] font-bold text-emerald-400">CORRECT</span>
                <span className="font-mono text-xs font-bold text-white">{correctHits}</span>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-1">
                <span className="block text-[9px] font-bold text-rose-400">WRONG</span>
                <span className="font-mono text-xs font-bold text-white">{mistakes}</span>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-1">
                <span className="block text-[9px] font-bold text-amber-400">MAX COMBO</span>
                <span className="font-mono text-xs font-bold text-white">{maxCombo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
