import React, { useState, useEffect, useRef } from 'react';
import { DrumType, ScreenType, AppSettings, HitRating } from '../types';
import { DRUMS } from '../data/drums';
import { DrumPad } from '../components/DrumPad';
import { CameraView } from '../components/CameraView';
import { cameraTracker, TrackingState } from '../services/cameraTracker';
import { audioEngine } from '../services/audio';
import {
  Camera,
  Volume2,
  VolumeX,
  ArrowLeft,
  Flame,
  Zap,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';

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
  onOpenSettings,
}) => {
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
  const [lastHitTime, setLastHitTime] = useState<number | null>(null);

  // Active hit state for each drum to trigger visual pulses
  const [activeHits, setActiveHits] = useState<
    Record<DrumType, { isHit: boolean; rating?: HitRating }>
  >({
    hihat: { isHit: false },
    tom: { isHit: false },
    crash: { isHit: false },
    snare: { isHit: false },
    kick: { isHit: false },
  });

  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to tracking state changes
  useEffect(() => {
    const unsub = cameraTracker.subscribeState((st) => {
      setTrackingState({ ...st });
    });
    return () => unsub();
  }, []);

  // Subscribe to camera hit detection
  useEffect(() => {
    const unsub = cameraTracker.subscribeHit((drum, energy) => {
      handleDrumHit(drum);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase();
      const matched = DRUMS.find(
        (d) => d.key === key || (d.id === 'kick' && (e.code === 'Space' || key === 'K'))
      );
      if (matched) {
        handleDrumHit(matched.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDrumHit = (drum: DrumType) => {
    // Play sound
    if (settings.sfxEnabled) {
      audioEngine.playDrum(drum);
    }

    // Set visual hit state
    setActiveHits((prev) => ({
      ...prev,
      [drum]: { isHit: true },
    }));

    // Reset hit state quickly for snappy feedback
    setTimeout(() => {
      setActiveHits((prev) => ({
        ...prev,
        [drum]: { isHit: false },
      }));
    }, 180);

    // Update Combo & Hits
    setLastHitDrum(drum);
    setLastHitTime(Date.now());
    setTotalHits((prev) => prev + 1);

    setCombo((prev) => {
      const next = prev + 1;
      setMaxCombo((m) => Math.max(m, next));
      return next;
    });

    // Reset combo after 2.5s of inactivity
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
    }, 2500);
  };

  const toggleCamera = async () => {
    if (trackingState.isStreaming) {
      cameraTracker.stop();
      onUpdateSettings({ cameraEnabled: false });
    } else {
      const ok = await cameraTracker.start(undefined, settings.selectedCameraId);
      onUpdateSettings({ cameraEnabled: ok });
    }
  };

  const lastDrumObj = DRUMS.find((d) => d.id === lastHitDrum);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            id="free-play-exit-btn"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit to Home</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Free Play
            </h1>
          </div>
        </div>

        {/* Quick HUD Metrics & Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Combo counter */}
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-400">
            <Flame className={`h-4 w-4 ${combo > 0 ? 'animate-bounce' : ''}`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 -mb-1">
                Combo
              </span>
              <span className="text-sm font-black font-mono">
                {combo} <span className="text-[10px] text-zinc-400 font-normal">/ max {maxCombo}</span>
              </span>
            </div>
          </div>

          {/* Last Hit Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-300">
            <Zap className="h-4 w-4 text-zinc-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 -mb-1">
                Last Hit
              </span>
              <span
                className="text-xs font-bold uppercase"
                style={{ color: lastDrumObj ? lastDrumObj.color : '#a1a1aa' }}
              >
                {lastDrumObj ? lastDrumObj.name : 'None'}
              </span>
            </div>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2 bg-zinc-900 rounded-xl border border-zinc-800 px-3 py-1">
            <button
              onClick={() => onUpdateSettings({ volume: settings.volume === 0 ? 0.85 : 0 })}
              className="text-zinc-400 hover:text-white"
            >
              {settings.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
              className="h-1.5 w-16 sm:w-20 accent-rose-500 cursor-pointer bg-zinc-800 rounded-lg"
            />
          </div>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Settings"
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Camera Video Zone + Drum Kit Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 flex-1 items-start">
        {/* Left / Center: Camera Video Mirror with Hand Tracking */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Webcam Tracking Mirror
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              Move your index finger onto a drum or tap it directly!
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
            onDrumClick={handleDrumHit}
            mirror={settings.mirrorCamera}
            showHandIndicators={settings.showHandIndicators}
          />

          {/* Tips Bar */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Tip: Keep your index fingertips visible, then move one onto a drum to play it.</span>
            </div>
            <span className="font-mono text-zinc-500 text-[11px]">Total Hits: {totalHits}</span>
          </div>
        </div>

        {/* Right: Studio Drum Pad Controller Console */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Drum Console
                </h2>
                <p className="text-[11px] text-zinc-400">Tactile drum pads with real-time feedback</p>
              </div>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                5 DRUMS
              </span>
            </div>

            {/* Drum Pads Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 justify-items-center">
              {/* Snare (Top Left) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[3]}
                  isHit={activeHits.snare.isHit}
                  energyPercent={trackingState.zoneEnergies.snare}
                  onClick={() => handleDrumHit('snare')}
                  size="sm"
                />
              </div>

              {/* Kick (Top Right) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[4]}
                  isHit={activeHits.kick.isHit}
                  energyPercent={trackingState.zoneEnergies.kick}
                  onClick={() => handleDrumHit('kick')}
                  size="sm"
                />
              </div>

              {/* Hi-Hat (Bottom Left) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[0]}
                  isHit={activeHits.hihat.isHit}
                  energyPercent={trackingState.zoneEnergies.hihat}
                  onClick={() => handleDrumHit('hihat')}
                  size="sm"
                />
              </div>

              {/* Crash (Bottom Right) */}
              <div className="col-span-1">
                <DrumPad
                  drum={DRUMS[2]}
                  isHit={activeHits.crash.isHit}
                  energyPercent={trackingState.zoneEnergies.crash}
                  onClick={() => handleDrumHit('crash')}
                  size="sm"
                />
              </div>

              {/* Tom (Bottom Center) */}
              <div className="col-span-2 justify-self-center">
                <DrumPad
                  drum={DRUMS[1]}
                  isHit={activeHits.tom.isHit}
                  energyPercent={trackingState.zoneEnergies.tom}
                  onClick={() => handleDrumHit('tom')}
                  size="sm"
                />
              </div>
            </div>

            {/* Quick Keyboard Reference */}
            <div className="mt-5 pt-3 border-t border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 block mb-2">
                Physical Keyboard Shortcuts
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {DRUMS.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleDrumHit(d.id)}
                    className="flex flex-col items-center p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {d.key}
                    </span>
                    <span className="text-[9px] text-zinc-400 truncate w-full">
                      {d.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
