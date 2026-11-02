import { useLanguage } from '@/i18n/LanguageProvider';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { DrumKitSelector } from '../components/DrumKitSelector';
import { cameraTracker, TrackingState } from '../services/cameraTracker';
import { audioEngine } from '../services/audio';
import { ArrowLeft, Flame, ShieldAlert, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useMultiplayerGame, CoopHitEvent } from '../hooks/useMultiplayerGame';
import { MultiplayerHUD } from '../components/MultiplayerHUD';
import { OpponentGameplayView } from '../components/OpponentGameplayView';

interface RhythmGameScreenProps {
  challenge: RhythmChallenge;
  onFinishGame: (
    result: GameResult,
    opponentResult?: { name: string; score: number; accuracy: number; combo: number } | null
  ) => void;
  onNavigate: (screen: ScreenType) => void;
  settings: AppSettings;
  roomSession?: {
    roomName: string;
    mode: 'versus' | 'together';
    roomId?: string;
    players?: { id: string; name: string; isHost?: boolean }[];
    isHost?: boolean;
  } | null;
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
  roomSession,
}) => {
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const currentUserId = profile?.id || 'you';
  const currentUserName = profile?.displayName || 'You';

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

  const isTogetherMode = roomSession?.mode === 'together';
  const isVersusMode = roomSession?.mode === 'versus';
  const isHost = roomSession?.isHost ?? true;

  // Turn calculation for Together mode (10 notes per turn)
  const turnIndex = Math.floor(currentNoteIndex / 10);
  const isHostTurn = turnIndex % 2 === 0;
  const isMyTurn = !isTogetherMode || (isHost ? isHostTurn : !isHostTurn);
  const notesHitInTurn = currentNoteIndex % 10;
  const notesRemainingInTurn = 10 - notesHitInTurn;

  const opponentPlayer = roomSession?.players?.find((p) => p.id !== currentUserId);
  const activePlayerName = isMyTurn ? currentUserName : (opponentPlayer?.name || t("Partner"));

  const [lastRemoteHit, setLastRemoteHit] = useState<{ drum: DrumType; rating: HitRating } | null>(null);

  const noteIndexRef = useRef(0);
  const finishedRef = useRef(false);
  const firstHitAtRef = useRef<number | null>(null);
  const replayEventsRef = useRef<NonNullable<GameResult['replayEvents']>>([]);
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

  const handleRemoteCoopHit = useCallback((event: CoopHitEvent) => {
    setLastRemoteHit({ drum: event.drum, rating: event.rating });

    setActiveHits((previous) => ({
      ...previous,
      [event.drum]: { isHit: true, rating: event.rating },
    }));
    window.setTimeout(() => {
      setActiveHits((previous) => ({
        ...previous,
        [event.drum]: { isHit: false },
      }));
    }, 200);

    const nextIndex = event.noteIndex;
    noteIndexRef.current = nextIndex;
    setCurrentNoteIndex(nextIndex);

    statsRef.current = {
      ...statsRef.current,
      score: event.teamScore,
      combo: event.teamCombo,
      maxCombo: Math.max(statsRef.current.maxCombo, event.teamCombo),
      perfectHits: statsRef.current.perfectHits + 1,
    };
    setScore(event.teamScore);
    setCombo(event.teamCombo);
    setMaxCombo(statsRef.current.maxCombo);
    setCorrectHits(statsRef.current.perfectHits);

    if (nextIndex >= totalNotes) {
      finishedRef.current = true;
      finishTimerRef.current = setTimeout(() => finishChallenge(statsRef.current), 350);
    }
  }, [totalNotes]);

  const { opponent, partnerDisconnected, sendVersusProgress, sendCoopHit, sendLeaveMatch } = useMultiplayerGame({
    roomId: roomSession?.roomId,
    mode: roomSession?.mode,
    currentUserId,
    currentUserName,
    players: roomSession?.players,
    onRemoteCoopHit: handleRemoteCoopHit,
  });

  // Cleanup: notify when leaving mid-game
  useEffect(() => {
    return () => {
      if (roomSession?.roomId) sendLeaveMatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (isVersusMode) {
      sendVersusProgress({
        score: finalStats.score,
        combo: finalStats.combo,
        accuracy: finalAccuracy,
        currentNoteIndex: totalNotes,
        totalNotes,
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

    onFinishGame(
      {
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
        replayEvents: replayEventsRef.current,
      },
      oppResult
    );
  }

  function evaluateDrumHit(drum: DrumType) {
    if (finishedRef.current) return;

    // In Together mode, if it's partner's turn, block input!
    if (isTogetherMode && !isMyTurn) {
      return;
    }

    if (settings.sfxEnabled) {
      audioEngine.playDrum(drum);
    }

    const noteIndex = noteIndexRef.current;
    const expectedNote = challenge.notes[noteIndex];
    if (!expectedNote) return;

    const isCorrect = expectedNote.drum === drum;
    const rating: HitRating = isCorrect ? 'perfect' : 'miss';
    if (firstHitAtRef.current === null) firstHitAtRef.current = Date.now();
    replayEventsRef.current.push({ drum, rating, timeMs: Date.now() - firstHitAtRef.current });

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

      const totalAttempts = nextStats.perfectHits + nextStats.misses;
      const currentAcc = totalAttempts === 0 ? 100 : Math.round((nextStats.perfectHits / totalAttempts) * 100);

      if (isTogetherMode) {
        sendCoopHit({
          drum,
          rating,
          noteIndex: nextIndex,
          teamScore: nextStats.score,
          teamCombo: nextStats.combo,
        });
      } else if (isVersusMode) {
        sendVersusProgress({
          score: nextStats.score,
          combo: nextStats.combo,
          accuracy: currentAcc,
          currentNoteIndex: nextIndex,
          totalNotes,
          lastHit: { drum, rating },
          activeHits: {
            ...activeHits,
            [drum]: { isHit: true, rating },
          },
          finished: nextIndex >= totalNotes,
        });
      }

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

      if (isVersusMode) {
        const totalAttempts = nextStats.perfectHits + nextStats.misses;
        const currentAcc = totalAttempts === 0 ? 100 : Math.round((nextStats.perfectHits / totalAttempts) * 100);
        sendVersusProgress({
          score: nextStats.score,
          combo: 0,
          accuracy: currentAcc,
          currentNoteIndex: noteIndex,
          totalNotes,
          lastHit: { drum, rating: 'miss' },
          activeHits: {
            ...activeHits,
            [drum]: { isHit: true, rating: 'miss' },
          },
          finished: false,
        });
      }
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
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-400 sm:text-base"> {t("Get Ready")} </div>
          <div className="bg-gradient-to-tr from-rose-500 to-amber-400 bg-clip-text text-8xl font-black text-transparent drop-shadow-2xl sm:text-9xl">
            {countdown === 0 ? t("GO!") : countdown}
          </div>
          <p className="mt-4 text-xs text-zinc-400"> {t("Play the highlighted drum. The next step waits for you.")} </p>
        </div>
      )}

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
            <span className="hidden sm:inline">{t("Abort")}</span>
          </Button>
          <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-white sm:text-lg">
            <span>{t(challenge.title)}</span>
            <Badge variant="outline" className="rounded border-amber-500/20 bg-amber-500/10 px-2 font-mono text-xs font-normal text-amber-400"> {t("Guided")} </Badge>
          </h1>
        </div>

        <DrumKitSelector compact />

        <div className="flex items-center gap-2 sm:gap-4">
          <Card className="gap-0 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-100">
            <span className="text-[10px] font-bold uppercase text-zinc-500">{t("Score")}</span>
            <span className="font-mono text-base font-black text-white sm:text-lg">
              {score.toLocaleString(locale)}
            </span>
          </Card>
          <Card className="flex-row items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-400">
            <Flame className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-amber-500/80">{t("Combo")}</span>
              <span className="font-mono text-sm font-black">{combo}</span>
            </div>
          </Card>
          <Card className="hidden gap-0 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-100 sm:flex">
            <span className="text-[10px] font-bold uppercase text-zinc-500">{t("Accuracy")}</span>
            <span className="font-mono text-sm font-black text-emerald-400">{accuracy}%</span>
          </Card>
          <Card className="flex-row items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-300">
            <Target className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-mono text-xs font-bold">
              {Math.min(currentNoteIndex + 1, totalNotes)}/{totalNotes}
            </span>
          </Card>
        </div>
      </div>

      <Progress
        value={progressPercent}
        aria-label={t("Challenge progress")}
        className="mt-2 gap-0 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-zinc-900 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-rose-500 [&_[data-slot=progress-indicator]]:to-amber-500"
      />

      {roomSession && (
        <div className="mt-3">
          <MultiplayerHUD
            mode={roomSession.mode}
            roomName={roomSession.roomName}
            myScore={score}
            myCombo={combo}
            opponent={opponent}
            opponentName={opponentPlayer?.name}
            currentNoteIndex={currentNoteIndex}
            isMyTurn={isMyTurn}
            activePlayerName={activePlayerName}
            notesRemainingInTurn={notesRemainingInTurn}
            teamScore={score}
            teamCombo={combo}
            lastRemoteHit={lastRemoteHit}
          />
        </div>
      )}

      <div className="mt-3 flex flex-1 flex-col gap-4">
        <Card className="min-h-20 flex-row items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-zinc-100">
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
                    {isTogetherMode && !isMyTurn ? t("Partner is playing") : t("Play this drum")}
                  </span>
                  <span className="text-xl font-black uppercase" style={{ color: currentDrum.color }}>
                    {t(currentDrum.name)}
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    {isTogetherMode && !isMyTurn
                      ? t("Input locked. Partner is playing now.")
                      : t("Waiting until you hit the correct drum")}
                  </p>
                </div>
              </div>
              {lastHitFeedback && (
                <Badge
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase ${lastHitFeedback.rating === 'perfect'
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-rose-500 text-white'
                    }`}
                >
                  {lastHitFeedback.rating === 'perfect' ? t("Correct") : t("Wrong drum")}
                </Badge>
              )}
            </>
          ) : (
            <div className="w-full text-center font-bold text-emerald-400">{t("Challenge complete!")}</div>
          )}
        </Card>

        <div className={`grid flex-1 grid-cols-1 gap-4 ${isVersusMode ? 'lg:grid-cols-[1fr_auto_1fr]' : 'lg:grid-cols-12'}`}>
          <div className={`relative flex flex-col ${isVersusMode ? '' : 'lg:col-span-8'}`}>
            {isTogetherMode && !isMyTurn && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]">
                <div className="rounded-xl border border-amber-500/40 bg-zinc-950/90 px-4 py-2 text-center shadow-xl">
                  <p className="text-sm font-bold text-amber-300">{t("Input locked. Partner is playing now.")}</p>
                  <p className="text-xs text-zinc-400">
                    {t("{name}'s turn ({hit}/10 notes) · Listen to their beats!", {
                      name: activePlayerName,
                      hit: notesHitInTurn,
                    })}
                  </p>
                </div>
              </div>
            )}
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

          <Card className={`justify-between gap-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 py-0 text-zinc-100 ${isVersusMode ? '' : 'lg:col-span-4'}`}>
            <CardHeader className="mb-2 flex-row items-center justify-between border-b border-zinc-800 p-4 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">{t("Guided Drums")}</span>
              <span className="text-[10px] text-zinc-500">{t("Tap / Camera")}</span>
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
            </CardContent>

            <CardContent className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-800 p-4 pt-2 text-center">
              <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
                <span className="block text-[9px] font-bold text-emerald-400">{t("CORRECT")}</span>
                <span className="font-mono text-xs font-bold text-white">{correctHits}</span>
              </Card>
              <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
                <span className="block text-[9px] font-bold text-rose-400">{t("WRONG")}</span>
                <span className="font-mono text-xs font-bold text-white">{mistakes}</span>
              </Card>
              <Card className="gap-0 rounded border border-zinc-800 bg-zinc-950/60 p-1 py-1 text-zinc-100">
                <span className="block text-[9px] font-bold text-amber-400">{t("MAX COMBO")}</span>
                <span className="font-mono text-xs font-bold text-white">{maxCombo}</span>
              </Card>
            </CardContent>
          </Card>

          {/* Versus mode: live opponent gameplay */}
          {isVersusMode && (
            <OpponentGameplayView
              opponent={opponent}
              opponentName={opponentPlayer?.name}
              myScore={score}
              totalNotes={totalNotes}
            />
          )}
        </div>
      </div>
    </div>
  );
};
