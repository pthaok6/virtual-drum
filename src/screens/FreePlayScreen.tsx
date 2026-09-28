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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

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
          <Button
            id="free-play-exit-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit to Home</span>
          </Button>

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

          {/* Last Hit Indicator */}
          <Card className="hidden gap-0 rounded-xl border border-zinc-800 bg-zinc-900/80 py-0 text-zinc-300 sm:flex">
            <CardContent className="flex items-center gap-2 px-3 py-1">
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
            </CardContent>
          </Card>

          {/* Volume control */}
          <div className="flex items-center gap-2 bg-zinc-900 rounded-xl border border-zinc-800 px-3 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onUpdateSettings({ volume: settings.volume === 0 ? 0.85 : 0 })}
              className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label={settings.volume === 0 ? 'Unmute' : 'Mute'}
            >
              {settings.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[settings.volume]}
              onValueChange={(value) => onUpdateSettings({ volume: Array.isArray(value) ? value[0] : value })}
              className="w-16 cursor-pointer sm:w-20 [&_[data-slot=slider-range]]:bg-rose-500 [&_[data-slot=slider-track]]:bg-zinc-800"
              aria-label="Master volume"
            />
          </div>

          {/* Settings button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Settings"
          >
            <Sliders className="h-3.5 w-3.5" />
          </Button>
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
          <Alert className="flex flex-wrap items-center justify-between gap-2 border-zinc-800/80 bg-zinc-900/50 p-3 text-xs text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <AlertDescription className="col-start-2 text-xs text-zinc-400">
              Tip: Keep your index fingertips visible, then move one onto a drum to play it.
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
                    onClick={() => handleDrumHit(d.id)}
                    className="h-auto min-w-0 flex-col gap-0 rounded-lg border-zinc-800 bg-zinc-950/80 p-1.5 hover:border-zinc-700 hover:bg-zinc-900"
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
