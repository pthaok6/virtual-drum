import React, { useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  BeatNote,
  DrumType,
  GameResult,
  HitRating,
  RhythmChallenge,
  ScreenType,
} from '../types';
import { DRUMS } from '../data/drums';
import { CameraView } from '../components/CameraView';
import { DrumPad } from '../components/DrumPad';
import { FallingNoteLane } from '../components/FallingNoteLane';
import { cameraTracker, TrackingState } from '../services/cameraTracker';
import { audioEngine } from '../services/audio';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { ArrowLeft, Flame, Target, Trophy, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
  const { user, updateScore } = useAuth();
  const [countdown, setCountdown] = useState<number | null>(3);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [notes, setNotes] = useState<BeatNote[]>(() =>
    challenge.notes.map((n) => ({ ...n, hit: false }))
  );

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectHits, setPerfectHits] = useState(0);
  const [goodHits, setGoodHits] = useState(0);
  const [misses, setMisses] = useState(0);

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

  const notesRef = useRef<BeatNote[]>(notes);
  notesRef.current = notes;

  const statsRef = useRef<ChallengeStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectHits: 0,
    goodHits: 0,
    misses: 0,
  });

  const finishedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const totalNotes = challenge.notes.length;
  const processedNotes = perfectHits + goodHits + misses;
  const progressPercent =
    totalNotes === 0 ? 100 : Math.min(100, (processedNotes / totalNotes) * 100);
  const accuracy =
    processedNotes === 0
      ? 100
      : Math.round(((perfectHits * 1.0 + goodHits * 0.7) / processedNotes) * 1000) / 10;

  // Finish challenge and save play record to leaderboard
  const finishChallenge = async (finalStats: ChallengeStats) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const totalProcessed = Math.max(1, finalStats.perfectHits + finalStats.goodHits + finalStats.misses);
    const finalAccuracy =
      Math.round(
        ((finalStats.perfectHits * 1.0 + finalStats.goodHits * 0.7) / totalProcessed) * 100
      );

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
      (total, _, index) => total + 350 * (index > 20 ? 3 : index > 10 ? 2 : 1),
      0
    );

    const result: GameResult = {
      challenge,
      score: finalStats.score,
      maxScore,
      accuracy: finalAccuracy,
      maxCombo: finalStats.maxCombo,
      perfectHits: finalStats.perfectHits,
      goodHits: finalStats.goodHits,
      misses: finalStats.misses,
      stars,
      rank,
    };

    // Save record to persistent storage and leaderboard
    try {
      await storageService.savePlayRecord({
        userId: user ? user.id : 'guest-player',
        username: user ? user.username : 'Drummer Pro',
        avatarUrl: user?.avatarUrl,
        trackId: challenge.id,
        trackTitle: challenge.title,
        score: finalStats.score,
        accuracy: finalAccuracy,
        maxCombo: finalStats.maxCombo,
        rank,
      });

      // Update user level and experience
      await updateScore(finalStats.score);
    } catch (e) {
      console.warn('Failed to save play record:', e);
    }

    onFinishGame(result);
  };

  // Evaluate note timing when drum is struck
  const evaluateDrumHit = (drum: DrumType, velocity: number = 0.85) => {
    if (finishedRef.current || countdown !== null) return;

    if (settings.sfxEnabled) {
      audioEngine.playDrum(drum, velocity, settings.drumKitPreset);
    }

    const currentNotes = notesRef.current;
    const nowMs = currentTimeMs;

    // Hit window tolerances:
    // Perfect: within 130ms
    // Good: within 250ms
    const HIT_WINDOW_MS = 260;

    // Find closest unhit note of this drum type
    let candidateIdx = -1;
    let minDiff = Infinity;

    for (let i = 0; i < currentNotes.length; i++) {
      const n = currentNotes[i];
      if (!n.hit && n.drum === drum) {
        const diff = Math.abs(n.timeMs - nowMs);
        if (diff < minDiff) {
          minDiff = diff;
          candidateIdx = i;
        }
      }
    }

    let rating: HitRating = 'miss';

    if (candidateIdx !== -1 && minDiff <= HIT_WINDOW_MS) {
      rating = minDiff <= 120 ? 'perfect' : 'good';

      // Mark note as hit
      const nextNotes = [...currentNotes];
      nextNotes[candidateIdx] = {
        ...nextNotes[candidateIdx],
        hit: true,
        hitRating: rating,
      };
      setNotes(nextNotes);

      // Score multiplier based on combo
      const currentStats = statsRef.current;
      const multiplier = currentStats.combo > 20 ? 3 : currentStats.combo > 10 ? 2 : 1;
      const points = (rating === 'perfect' ? 350 : 180) * multiplier;
      const nextCombo = currentStats.combo + 1;

      const nextStats: ChallengeStats = {
        ...currentStats,
        score: currentStats.score + points,
        combo: nextCombo,
        maxCombo: Math.max(currentStats.maxCombo, nextCombo),
        perfectHits: rating === 'perfect' ? currentStats.perfectHits + 1 : currentStats.perfectHits,
        goodHits: rating === 'good' ? currentStats.goodHits + 1 : currentStats.goodHits,
      };
      statsRef.current = nextStats;

      setScore(nextStats.score);
      setCombo(nextStats.combo);
      setMaxCombo(nextStats.maxCombo);
      setPerfectHits(nextStats.perfectHits);
      setGoodHits(nextStats.goodHits);

      audioEngine.playHitSound(rating);
    } else {
      // Off-beat or wrong drum hit
      const currentStats = statsRef.current;
      const nextStats: ChallengeStats = {
        ...currentStats,
        combo: 0,
        misses: currentStats.misses + 1,
      };
      statsRef.current = nextStats;

      setCombo(0);
      setMisses(nextStats.misses);
      audioEngine.playHitSound('miss');
    }

    // Trigger visual pulse
    setActiveHits((prev) => ({
      ...prev,
      [drum]: { isHit: true, rating },
    }));

    window.setTimeout(() => {
      setActiveHits((prev) => ({
        ...prev,
        [drum]: { isHit: false },
      }));
    }, 180);

    setLastHitFeedback({ drum, rating });
  };

  // Subscribe to camera tracking and hits
  useEffect(() => {
    const unsubState = cameraTracker.subscribeState((st) => {
      setTrackingState({ ...st });
    });
    const unsubHit = cameraTracker.subscribeHit((drum, velocity) => {
      evaluateDrumHit(drum, velocity);
    });

    return () => {
      unsubState();
      unsubHit();
    };
  }, [countdown, settings.drumKitPreset, settings.sfxEnabled]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || countdown !== null || finishedRef.current) return;
      const key = e.key.toUpperCase();
      const drum = DRUMS.find(
        (item) => item.key === key || (item.id === 'kick' && e.code === 'Space')
      );
      if (drum) evaluateDrumHit(drum.id, 0.9);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [countdown, settings.drumKitPreset, settings.sfxEnabled]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      audioEngine.playCountdownBeep(false);
      const timer = window.setTimeout(() => setCountdown(countdown - 1), 750);
      return () => window.clearTimeout(timer);
    }

    audioEngine.playCountdownBeep(true);
    const timer = window.setTimeout(() => {
      setCountdown(null);
      startTimeRef.current = performance.now();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  // Game loop timeline ticker and auto-miss evaluator
  useEffect(() => {
    if (countdown !== null) return;

    let isRunning = true;

    const loop = (timestamp: number) => {
      if (!isRunning || finishedRef.current) return;

      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = Math.round(timestamp - startTimeRef.current);
      setCurrentTimeMs(elapsed);

      // Check notes that passed the hit window without being struck (Miss)
      const MISS_THRESHOLD_MS = 250;
      let missedCount = 0;
      const updatedNotes = notesRef.current.map((n) => {
        if (!n.hit && n.timeMs + MISS_THRESHOLD_MS < elapsed) {
          missedCount++;
          return { ...n, hit: true, hitRating: 'miss' as HitRating };
        }
        return n;
      });

      if (missedCount > 0) {
        notesRef.current = updatedNotes;
        setNotes(updatedNotes);
        const nextStats = {
          ...statsRef.current,
          combo: 0,
          misses: statsRef.current.misses + missedCount,
        };
        statsRef.current = nextStats;
        setCombo(0);
        setMisses(nextStats.misses);
      }

      // Check if song completed (passed last note by 1.8 seconds)
      const lastNote = challenge.notes[challenge.notes.length - 1];
      if (lastNote && elapsed > lastNote.timeMs + 1800) {
        finishChallenge(statsRef.current);
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [countdown, challenge]);

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-400 sm:text-base">
            Get Ready
          </div>
          <div className="bg-gradient-to-tr from-rose-500 via-amber-400 to-yellow-300 bg-clip-text text-8xl font-black text-transparent drop-shadow-2xl sm:text-9xl animate-scale">
            {countdown === 0 ? 'START!' : countdown}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Follow the falling notes on Beat Highway and hit on the beat!
          </p>
        </div>
      )}

      {/* Top HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('challenge-select')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Abort</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-white sm:text-lg">
              <span>{challenge.title}</span>
              <Badge variant="outline" className="rounded border-amber-500/20 bg-amber-500/10 px-2 font-mono text-xs font-normal text-amber-400">
                {challenge.difficulty}
              </Badge>
            </h1>
            <span className="text-[11px] text-zinc-400">{challenge.artist} • {challenge.bpm} BPM</span>
          </div>
        </div>

        {/* Real-time Game Stats */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Card className="gap-0 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Score</span>
            <span className="font-mono text-base font-black text-amber-400 sm:text-lg">
              {score.toLocaleString()}
            </span>
          </Card>

          <Card className="flex-row items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-400">
            <Flame className="h-4 w-4 fill-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-amber-500/80">Combo</span>
              <span className="font-mono text-sm font-black">{combo}</span>
            </div>
          </Card>

          <Card className="hidden gap-0 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-100 sm:flex">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Accuracy</span>
            <span className="font-mono text-sm font-black text-emerald-400">{accuracy}%</span>
          </Card>

          <Card className="flex-row items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-300">
            <Target className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-mono text-xs font-bold">
              {Math.min(processedNotes, totalNotes)}/{totalNotes}
            </span>
          </Card>
        </div>
      </div>

      {/* Challenge Progress Bar */}
      <Progress
        value={progressPercent}
        aria-label="Track progress"
        className="mt-2 gap-0 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-zinc-900 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-rose-500 [&_[data-slot=progress-indicator]]:to-amber-500"
      />

      {/* Falling Note Lane Highway */}
      <div className="mt-3">
        <FallingNoteLane
          notes={notes}
          currentTimeMs={currentTimeMs}
          bpm={challenge.bpm}
          combo={combo}
          lastHitFeedback={lastHitFeedback}
          activeHits={activeHits}
          onDrumClick={evaluateDrumHit}
        />
      </div>

      {/* Main Gameplay Screen: Camera Tracking & Drum Console */}
      <div className="mt-3 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12 items-start">
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
            mirror={settings.mirrorCamera}
            showHandIndicators={settings.showHandIndicators}
          />
        </div>

        {/* Drum Pads & Live Stats Console */}
        <Card className="justify-between gap-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 py-0 text-zinc-100 lg:col-span-4 shadow-xl">
          <CardHeader className="mb-2 flex-row items-center justify-between border-b border-zinc-800 p-4 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Tactile Drum Pads</span>
            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800">
              {settings.drumKitPreset.toUpperCase()} KIT
            </Badge>
          </CardHeader>

          <CardContent className="grid grid-cols-2 justify-items-center gap-2 px-4">
            {(['snare', 'kick', 'hihat', 'crash'] as DrumType[]).map((drumId) => {
              const drum = DRUMS.find((item) => item.id === drumId)!;
              return (
                <DrumPad
                  key={drum.id}
                  drum={drum}
                  isHit={activeHits[drum.id].isHit}
                  hitRating={activeHits[drum.id].rating}
                  energyPercent={trackingState.zoneEnergies[drum.id]}
                  onClick={() => evaluateDrumHit(drum.id, 0.9)}
                  size="sm"
                />
              );
            })}
            <div className="col-span-2">
              <DrumPad
                drum={DRUMS[1]}
                isHit={activeHits.tom.isHit}
                hitRating={activeHits.tom.rating}
                energyPercent={trackingState.zoneEnergies.tom}
                onClick={() => evaluateDrumHit('tom', 0.9)}
                size="sm"
              />
            </div>
          </CardContent>

          <CardContent className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-800 p-4 pt-2 text-center">
            <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
              <span className="block text-[9px] font-bold text-amber-400">PERFECT</span>
              <span className="font-mono text-xs font-bold text-white">{perfectHits}</span>
            </Card>
            <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
              <span className="block text-[9px] font-bold text-emerald-400">GOOD</span>
              <span className="font-mono text-xs font-bold text-white">{goodHits}</span>
            </Card>
            <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
              <span className="block text-[9px] font-bold text-rose-400">MISS</span>
              <span className="font-mono text-xs font-bold text-white">{misses}</span>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
