import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DrumType, ScreenType, AppSettings, HitRating, DrumKitPreset, RecordedHit } from '../types';
import { DRUMS } from '../data/drums';
import { DrumPad } from '../components/DrumPad';
import { CameraView } from '../components/CameraView';
import { LooperControl } from '../components/LooperControl';
import { cameraTracker, TrackingState } from '../services/cameraTracker';
import { audioEngine } from '../services/audio';
import { recordingsStorage } from '../services/recordingsStorage';
import { renderHitsToWav, downloadFile } from '../services/wavExporter';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  ArrowLeft,
  Flame,
  Zap,
  Sparkles,
  Activity,
  Music,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FreePlayScreenProps {
  onNavigate: (screen: ScreenType) => void;
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
}

export const FreePlayScreen: React.FC<FreePlayScreenProps> = ({
  onNavigate,
  settings,
  onUpdateSettings,
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isStreaming: false,
    isInitializing: false,
    permissionGranted: false,
    error: null,
    leftHand: { x: 30, y: 50, isActive: false },
    rightHand: { x: 70, y: 50, isActive: false },
    zoneEnergies: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 },
  });

  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [lastHitDrum, setLastHitDrum] = useState<DrumType | null>(null);
  const [lastVelocity, setLastVelocity] = useState<number>(0.85);

  // ==========================================
  // RECORD & LOOPER STATE
  // ==========================================
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlayingLoop, setIsPlayingLoop] = useState<boolean>(false);
  const [isOverdubbing, setIsOverdubbing] = useState<boolean>(false);
  const [recordedHits, setRecordedHits] = useState<RecordedHit[]>([]);
  const [loopDurationMs, setLoopDurationMs] = useState<number>(0);
  const [currentPlayheadMs, setCurrentPlayheadMs] = useState<number>(0);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLoopMode, setIsLoopMode] = useState<boolean>(false); // Default false: Single Playback (Plays once)
  const [trimFeedback, setTrimFeedback] = useState<string | null>(null);
  const [isSavedToLibrary, setIsSavedToLibrary] = useState<boolean>(false);

  // References to prevent stale closure in audio & video loops
  const isArmedRef = useRef(false);
  isArmedRef.current = isArmed;

  const isLoopModeRef = useRef(false);
  isLoopModeRef.current = isLoopMode;

  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;

  const isOverdubbingRef = useRef(false);
  isOverdubbingRef.current = isOverdubbing;

  const isPlayingLoopRef = useRef(false);
  isPlayingLoopRef.current = isPlayingLoop;

  const recordedHitsRef = useRef<RecordedHit[]>([]);
  recordedHitsRef.current = recordedHits;

  const loopDurationMsRef = useRef<number>(0);
  loopDurationMsRef.current = loopDurationMs;

  const playheadMsRef = useRef<number>(0);
  playheadMsRef.current = currentPlayheadMs;

  const playbackSpeedRef = useRef<number>(1.0);
  playbackSpeedRef.current = playbackSpeed;

  const recordStartTimeRef = useRef<number>(0);
  const loopStartWallTimeRef = useRef<number>(0);
  const lastPlayheadRef = useRef<number>(0);
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopAnimFrameRef = useRef<number | null>(null);

  // Active hit visual pulse state for each drum pad (Live User Hits)
  const [activeHits, setActiveHits] = useState<
    Record<DrumType, { isHit: boolean; rating?: HitRating }>
  >({
    hihat: { isHit: false },
    tom: { isHit: false },
    crash: { isHit: false },
    snare: { isHit: false },
    kick: { isHit: false },
  });

  // Playback hit visual pulse state (Backing Loop Track Notes)
  const [playbackHits, setPlaybackHits] = useState<Record<DrumType, boolean>>({
    hihat: false,
    tom: false,
    crash: false,
    snare: false,
    kick: false,
  });

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync Audio preset
  useEffect(() => {
    audioEngine.setPreset(settings.drumKitPreset);
  }, [settings.drumKitPreset]);

  // Clean up looper loops on unmount
  useEffect(() => {
    return () => {
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      if (loopAnimFrameRef.current) cancelAnimationFrame(loopAnimFrameRef.current);
    };
  }, []);

  // Visual pulse helper for live user hits
  const triggerVisualHit = useCallback((drum: DrumType) => {
    setActiveHits((prev) => ({
      ...prev,
      [drum]: { isHit: true },
    }));

    setTimeout(() => {
      setActiveHits((prev) => ({
        ...prev,
        [drum]: { isHit: false },
      }));
    }, 140);
  }, []);

  // Visual pulse helper for backing loop playback notes
  const triggerPlaybackPulse = useCallback((drum: DrumType) => {
    setPlaybackHits((prev) => ({
      ...prev,
      [drum]: true,
    }));

    setTimeout(() => {
      setPlaybackHits((prev) => ({
        ...prev,
        [drum]: false,
      }));
    }, 110);
  }, []);

  // Main Live Drum Hit Handler (Webcam Gesture, Touch, Click, Keyboard)
  const handleDrumHit = useCallback(
    (drum: DrumType, velocity: number = 0.85) => {
      // 1. Play sound
      if (settings.sfxEnabled) {
        const effectiveVelocity = velocity * (settings.velocitySensitivity ?? 1.0);
        audioEngine.playDrum(drum, effectiveVelocity, settings.drumKitPreset);
      }

      setLastVelocity(velocity);
      triggerVisualHit(drum);

      // 2. Record note if Armed, Recording or Overdubbing
      const hitId = `hit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (isArmedRef.current) {
        // First hit arrived! Instant Smart-Start recording with 0ms dead silence!
        setIsArmed(false);
        isArmedRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
        recordStartTimeRef.current = performance.now();

        const firstHit: RecordedHit = {
          id: hitId,
          drum,
          timestampMs: 0,
          velocity,
        };
        setRecordedHits([firstHit]);
        recordedHitsRef.current = [firstHit];

        if (recIntervalRef.current) clearInterval(recIntervalRef.current);
        recIntervalRef.current = setInterval(() => {
          setRecordingElapsedMs(Math.round(performance.now() - recordStartTimeRef.current));
        }, 40);
      } else if (isRecordingRef.current) {
        const offsetMs = Math.max(0, Math.round(performance.now() - recordStartTimeRef.current));
        const newHit: RecordedHit = {
          id: hitId,
          drum,
          timestampMs: offsetMs,
          velocity,
        };
        setRecordedHits((prev) => [...prev, newHit]);
      } else if (isOverdubbingRef.current && isPlayingLoopRef.current && loopDurationMsRef.current > 0) {
        const offsetMs = Math.max(0, Math.round(playheadMsRef.current % loopDurationMsRef.current));
        const newHit: RecordedHit = {
          id: hitId,
          drum,
          timestampMs: offsetMs,
          velocity,
        };
        setRecordedHits((prev) =>
          [...prev, newHit].sort((a, b) => a.timestampMs - b.timestampMs)
        );
      }

      // 3. Update Combo & Hits stats
      setLastHitDrum(drum);
      setTotalHits((prev) => prev + 1);

      setCombo((prev) => {
        const next = prev + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        setCombo(0);
      }, 2500);
    },
    [settings.sfxEnabled, settings.drumKitPreset, triggerVisualHit]
  );

  // ==========================================
  // LOOPER CONTROLLER ACTIONS
  // ==========================================
  const startRecording = () => {
    // If playing existing loop, pause it
    if (isPlayingLoop) {
      setIsPlayingLoop(false);
      if (loopAnimFrameRef.current) cancelAnimationFrame(loopAnimFrameRef.current);
    }

    setRecordedHits([]);
    setLoopDurationMs(0);
    setCurrentPlayheadMs(0);
    setRecordingElapsedMs(0);
    setIsOverdubbing(false);

    // Enter Armed Mode: waits for user's 1st strike so recording begins at 0.0s!
    setIsArmed(true);
    isArmedRef.current = true;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsSavedToLibrary(false);
  };

  const handleSaveToLibrary = () => {
    if (recordedHits.length === 0 || loopDurationMs <= 0) return;
    if (!isAuthenticated || !user || user.id.startsWith('guest-')) {
      alert('Guest accounts can only play and preview recordings, but cannot save to the library! Please sign in to save your recordings.');
      openAuthModal();
      return;
    }
    const title = `FreePlay Jam (${(loopDurationMs / 1000).toFixed(1)}s)`;
    recordingsStorage.saveRecording(
      title,
      recordedHits,
      loopDurationMs,
      settings.drumKitPreset,
      user.username,
      user.id
    );
    setIsSavedToLibrary(true);
  };

  const handleDownloadWav = async () => {
    if (recordedHits.length === 0 || loopDurationMs <= 0) return;
    try {
      const blob = await renderHitsToWav(recordedHits, loopDurationMs, settings.drumKitPreset);
      downloadFile(blob, `freeplay-jam-${Date.now()}.wav`);
    } catch (e) {
      console.error('Failed to render WAV:', e);
    }
  };

  const stopRecording = () => {
    if (isArmedRef.current) {
      setIsArmed(false);
      isArmedRef.current = false;
      return;
    }
    if (!isRecordingRef.current) return;
    if (recIntervalRef.current) {
      clearInterval(recIntervalRef.current);
      recIntervalRef.current = null;
    }

    const duration = Math.max(800, Math.round(performance.now() - recordStartTimeRef.current));
    setLoopDurationMs(duration);
    setIsRecording(false);
    isRecordingRef.current = false;

    // Automatically start looping if hits were recorded
    if (recordedHitsRef.current.length > 0) {
      startLoopPlayback(duration);
    }
  };

  const startLoopPlayback = (duration: number = loopDurationMs) => {
    if (duration <= 0 || recordedHitsRef.current.length === 0) return;

    setIsPlayingLoop(true);
    loopStartWallTimeRef.current = performance.now();
    lastPlayheadRef.current = 0;

    let lastUiFrame = 0;

    const playLoopFrame = (now: number) => {
      if (!isPlayingLoopRef.current || loopDurationMsRef.current <= 0) return;

      const dur = loopDurationMsRef.current;
      const speed = playbackSpeedRef.current;
      const elapsed = (now - loopStartWallTimeRef.current) * speed;
      const lastPlayhead = lastPlayheadRef.current;

      // ==========================================
      // SINGLE PLAYBACK MODE (Plays Once)
      // ==========================================
      if (!isLoopModeRef.current) {
        if (elapsed >= dur) {
          // Play any remaining notes in the last moment
          const hits = recordedHitsRef.current;
          for (let i = 0; i < hits.length; i++) {
            const h = hits[i];
            if (h.timestampMs >= lastPlayhead && h.timestampMs <= dur) {
              audioEngine.playDrum(h.drum, h.velocity, settings.drumKitPreset);
              triggerPlaybackPulse(h.drum);
            }
          }

          // Finish single playback cleanly!
          setIsPlayingLoop(false);
          isPlayingLoopRef.current = false;
          setIsOverdubbing(false);
          isOverdubbingRef.current = false;
          lastPlayheadRef.current = 0;
          setCurrentPlayheadMs(0);
          playheadMsRef.current = 0;
          return;
        }

        const playhead = elapsed;
        const hits = recordedHitsRef.current;
        for (let i = 0; i < hits.length; i++) {
          const h = hits[i];
          if (h.timestampMs >= lastPlayhead && h.timestampMs < playhead) {
            audioEngine.playDrum(h.drum, h.velocity, settings.drumKitPreset);
            triggerPlaybackPulse(h.drum);
          }
        }

        lastPlayheadRef.current = playhead;
        playheadMsRef.current = playhead;

        if (now - lastUiFrame >= 48) {
          lastUiFrame = now;
          setCurrentPlayheadMs(playhead);
        }

        loopAnimFrameRef.current = requestAnimationFrame(playLoopFrame);
        return;
      }

      // ==========================================
      // CONTINUOUS LOOP MODE (Repeat indefinitely)
      // ==========================================
      const playhead = elapsed % dur;
      const hits = recordedHitsRef.current;
      if (playhead >= lastPlayhead) {
        for (let i = 0; i < hits.length; i++) {
          const h = hits[i];
          if (h.timestampMs >= lastPlayhead && h.timestampMs < playhead) {
            audioEngine.playDrum(h.drum, h.velocity, settings.drumKitPreset);
            triggerPlaybackPulse(h.drum);
          }
        }
      } else {
        // Cycle wrapped around 0
        for (let i = 0; i < hits.length; i++) {
          const h = hits[i];
          if (h.timestampMs >= lastPlayhead || h.timestampMs < playhead) {
            audioEngine.playDrum(h.drum, h.velocity, settings.drumKitPreset);
            triggerPlaybackPulse(h.drum);
          }
        }
      }

      lastPlayheadRef.current = playhead;
      playheadMsRef.current = playhead;

      // Throttle React state update to ~20fps to keep main thread ultra-fluid for 60fps MediaPipe tracking,
      // while audio engine and ref remain sub-millisecond accurate!
      if (now - lastUiFrame >= 48) {
        lastUiFrame = now;
        setCurrentPlayheadMs(playhead);
      }

      loopAnimFrameRef.current = requestAnimationFrame(playLoopFrame);
    };

    if (loopAnimFrameRef.current) cancelAnimationFrame(loopAnimFrameRef.current);
    loopAnimFrameRef.current = requestAnimationFrame(playLoopFrame);
  };

  const toggleLoopPlay = () => {
    if (isPlayingLoop) {
      setIsPlayingLoop(false);
      setIsOverdubbing(false);
      if (loopAnimFrameRef.current) cancelAnimationFrame(loopAnimFrameRef.current);
    } else {
      startLoopPlayback(loopDurationMs);
    }
  };

  const toggleOverdub = () => {
    if (!isPlayingLoop) {
      // Start playback first
      startLoopPlayback(loopDurationMs);
      setIsOverdubbing(true);
    } else {
      setIsOverdubbing((prev) => !prev);
    }
  };

  const toggleLoopMode = () => {
    setIsLoopMode((prev) => !prev);
  };

  const trimLoop = () => {
    const hits = recordedHitsRef.current;
    const currentDuration = loopDurationMsRef.current;
    if (hits.length === 0 || currentDuration <= 0) return;

    // 1. Find true maximum timestamp across all recorded hits
    const maxTimestamp = Math.max(...hits.map((h) => h.timestampMs));
    const tailSilenceMs = currentDuration - maxTimestamp;

    // Natural acoustic decay (200ms) for the last drum hit
    const naturalTailDecay = 200;

    if (tailSilenceMs <= naturalTailDecay + 50) {
      setTrimFeedback('Tail is already tight (no dead silence)!');
      setTimeout(() => setTrimFeedback(null), 2500);
      return;
    }

    // New duration trimmed right after the final hit decay
    let newDuration = Math.round(maxTimestamp + naturalTailDecay);
    newDuration = Math.max(500, Math.min(newDuration, currentDuration - 50));
    const cutAmount = currentDuration - newDuration;

    setLoopDurationMs(newDuration);
    loopDurationMsRef.current = newDuration;

    const savedSec = (cutAmount / 1000).toFixed(1);
    setTrimFeedback(`Trimmed -${savedSec}s tail silence! New length: ${(newDuration / 1000).toFixed(1)}s`);
    setTimeout(() => setTrimFeedback(null), 3500);

    // 2. Immediately start playback so user hears the trimmed track instantly!
    startLoopPlayback(newDuration);
  };

  const clearLoop = () => {
    if (recIntervalRef.current) clearInterval(recIntervalRef.current);
    if (loopAnimFrameRef.current) cancelAnimationFrame(loopAnimFrameRef.current);
    setIsArmed(false);
    setIsRecording(false);
    setIsPlayingLoop(false);
    setIsOverdubbing(false);
    isArmedRef.current = false;
    isRecordingRef.current = false;
    isPlayingLoopRef.current = false;
    isOverdubbingRef.current = false;
    setRecordedHits([]);
    setLoopDurationMs(0);
    setCurrentPlayheadMs(0);
    setRecordingElapsedMs(0);
    setTrimFeedback(null);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    if (isPlayingLoop) {
      loopStartWallTimeRef.current =
        performance.now() - (currentPlayheadMs / speed);
    }
  };

  // Subscribe to tracking state changes
  useEffect(() => {
    const unsub = cameraTracker.subscribeState((st) => {
      setTrackingState({ ...st });
    });
    return () => unsub();
  }, []);

  // Subscribe to camera hit detection (with velocity)
  useEffect(() => {
    const unsub = cameraTracker.subscribeHit((drum, velocity) => {
      handleDrumHit(drum, velocity);
    });
    return () => unsub();
  }, [handleDrumHit]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase();
      const matched = DRUMS.find(
        (d) => d.key === key || (d.id === 'kick' && (e.code === 'Space' || key === 'K'))
      );
      if (matched) {
        handleDrumHit(matched.id, 0.9);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDrumHit]);

  const toggleCamera = async () => {
    if (trackingState.isStreaming) {
      cameraTracker.stop();
      onUpdateSettings({ cameraEnabled: false });
    } else {
      const ok = await cameraTracker.start(undefined, settings.selectedCameraId);
      onUpdateSettings({ cameraEnabled: ok });
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            id="free-play-exit-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Free Play Studio
            </h1>
          </div>
        </div>

        {/* Quick HUD Metrics & Controls */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Drum Kit Preset Selector */}
          <div className="w-44 sm:w-52">
            <Select
              value={settings.drumKitPreset}
              onValueChange={(val) => onUpdateSettings({ drumKitPreset: val as DrumKitPreset })}
            >
              <SelectTrigger className="border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
                <Music className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
                <SelectValue placeholder="Select Drum Kit" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-xs text-zinc-200">
                <SelectItem value="acoustic">🥁 Acoustic Studio Kit</SelectItem>
                <SelectItem value="electronic">🎛️ 808 Electronic Hip-hop</SelectItem>
                <SelectItem value="rock">⚡ Hard Rock Kit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Velocity impact meter */}
          <Card className="hidden sm:flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-300">
            <Activity className="h-4 w-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-zinc-500">Velocity Impact</span>
              <span className="font-mono text-xs font-black text-cyan-300">
                {Math.round(lastVelocity * 100)}%
              </span>
            </div>
          </Card>

          {/* Combo counter */}
          <Card className="gap-0 rounded-xl border border-amber-500/20 bg-amber-500/10 py-0 text-amber-400">
            <CardContent className="flex items-center gap-2 px-3 py-1">
              <Flame className={`h-4 w-4 ${combo > 0 ? 'animate-bounce' : ''}`} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 -mb-1">
                  Combo
                </span>
                <span className="text-sm font-black font-mono">
                  {combo} <span className="text-[10px] text-zinc-400 font-normal">/ max {maxCombo}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record & Looper Module (Replaced Metronome) */}
      <div className="mt-3">
        <LooperControl
          isRecording={isRecording}
          isArmed={isArmed}
          isPlaying={isPlayingLoop}
          isOverdubbing={isOverdubbing}
          recordedHits={recordedHits}
          loopDurationMs={loopDurationMs}
          currentPlayheadMs={currentPlayheadMs}
          recordingElapsedMs={recordingElapsedMs}
          playbackSpeed={playbackSpeed}
          isLoopMode={isLoopMode}
          trimFeedback={trimFeedback}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onTogglePlay={toggleLoopPlay}
          onToggleOverdub={toggleOverdub}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onSpeedChange={handleSpeedChange}
          onTrimLoop={trimLoop}
          isSaved={isSavedToLibrary}
          onSaveToLibrary={handleSaveToLibrary}
          onDownloadWav={handleDownloadWav}
          onOpenLibrary={() => onNavigate('recordings')}
        />
      </div>

      {/* Main Grid: Camera Video Zone + Drum Kit Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 flex-1 items-start">
        {/* Left / Center: Camera Video Mirror with Hand Tracking */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Webcam Tracking Mirror (Dual Hands & Velocity)
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              Strike down briskly with your index finger for punchier, louder hits!
            </span>
          </div>

          <CameraView
            isCameraActive={trackingState.isStreaming}
            isCameraInitializing={trackingState.isInitializing}
            cameraError={trackingState.error}
            onToggleCamera={toggleCamera}
            leftHand={trackingState.leftHand}
            rightHand={trackingState.rightHand}
            zoneEnergies={trackingState.zoneEnergies}
            activeHits={activeHits}
            playbackHits={playbackHits}
            onDrumClick={(drum) => handleDrumHit(drum, 0.9)}
            mirror={settings.mirrorCamera}
            showHandIndicators={settings.showHandIndicators}
          />

          {/* Tips Bar */}
          <Alert className="flex flex-wrap items-center justify-between gap-2 border-zinc-800/80 bg-zinc-900/50 p-3 text-xs text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <AlertDescription className="col-start-2 text-xs text-zinc-400">
              Tip: Hit "Record New Loop", lay down a beat, and click "Overdub" to layer more percussion on top!
            </AlertDescription>
            <span className="ml-auto font-mono text-[11px] text-zinc-500">Total Hits: {totalHits}</span>
          </Alert>
        </div>

        {/* Right: Studio Drum Pad Controller Console */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <Card className="gap-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 py-0 text-zinc-100 shadow-xl backdrop-blur-md">
            <CardHeader className="mb-4 flex-row items-center justify-between border-b border-zinc-800 p-5 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Drum Console
                </h2>
                <p className="text-[11px] text-zinc-400">Tactile drum pads with real-time feedback</p>
              </div>
              <Badge variant="secondary" className="rounded-md bg-zinc-800 px-2 font-mono text-[10px] text-zinc-300">
                5 DRUMS
              </Badge>
            </CardHeader>

            {/* Drum Pads Grid */}
            <CardContent className="grid grid-cols-2 justify-items-center gap-3 px-5 sm:gap-4">
              {/* Snare (Top Left) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[3]}
                  isHit={activeHits.snare.isHit}
                  isPlaybackHit={playbackHits.snare}
                  energyPercent={trackingState.zoneEnergies.snare}
                  onClick={() => handleDrumHit('snare', 0.9)}
                  size="sm"
                />
              </div>

              {/* Kick (Top Right) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[4]}
                  isHit={activeHits.kick.isHit}
                  isPlaybackHit={playbackHits.kick}
                  energyPercent={trackingState.zoneEnergies.kick}
                  onClick={() => handleDrumHit('kick', 0.9)}
                  size="sm"
                />
              </div>

              {/* Hi-Hat (Bottom Left) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[0]}
                  isHit={activeHits.hihat.isHit}
                  isPlaybackHit={playbackHits.hihat}
                  energyPercent={trackingState.zoneEnergies.hihat}
                  onClick={() => handleDrumHit('hihat', 0.9)}
                  size="sm"
                />
              </div>

              {/* Crash (Bottom Right) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[2]}
                  isHit={activeHits.crash.isHit}
                  isPlaybackHit={playbackHits.crash}
                  energyPercent={trackingState.zoneEnergies.crash}
                  onClick={() => handleDrumHit('crash', 0.9)}
                  size="sm"
                />
              </div>

              {/* Tom (Bottom Center) */}
              <div className="col-span-2 justify-self-center">
                <DrumPad
                  drum={DRUMS[1]}
                  isHit={activeHits.tom.isHit}
                  isPlaybackHit={playbackHits.tom}
                  energyPercent={trackingState.zoneEnergies.tom}
                  onClick={() => handleDrumHit('tom', 0.9)}
                  size="sm"
                />
              </div>
            </CardContent>

            {/* Quick Keyboard Reference */}
            <Separator className="mt-5 bg-zinc-800/80" />
            <CardContent className="px-5 pb-5 pt-3">
              <span className="text-[11px] font-bold text-zinc-400 block mb-2">
                Physical Keyboard Shortcuts
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {DRUMS.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    variant="outline"
                    onClick={() => handleDrumHit(d.id, 0.9)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleDrumHit(d.id, 0.9);
                    }}
                    className="h-auto min-w-0 flex-col gap-0 rounded-lg border-zinc-800 bg-zinc-950/80 p-1.5 hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer"
                  >
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {d.key}
                    </span>
                    <span className="text-[9px] text-zinc-400 truncate w-full">
                      {d.name}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
