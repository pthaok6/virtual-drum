import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DRUMS } from '../data/drums';
import { DrumType, HitRating, NormalizedZone } from '../types';
import { cameraTracker, HandPosition } from '../services/cameraTracker';
import {
  drumLayoutService,
  DrumLayoutMap,
  DEFAULT_DRUM_LAYOUT,
  LAYOUT_PRESETS,
} from '../services/drumLayout';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Move,
  Maximize2,
  Sliders,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CameraViewProps {
  isCameraActive: boolean;
  isCameraInitializing?: boolean;
  cameraError?: string | null;
  onToggleCamera: () => void;
  leftHand: HandPosition;
  rightHand: HandPosition;
  zoneEnergies: Record<DrumType, number>;
  activeHits: Record<DrumType, { isHit: boolean; rating?: HitRating }>;
  playbackHits?: Record<DrumType, boolean>;
  onDrumClick?: (drum: DrumType) => void;
  promptedDrum?: DrumType | null;
  mirror?: boolean;
  showHandIndicators?: boolean;
  // Layout customization controls
  allowLayoutEditing?: boolean;
  onLayoutChange?: (layout: DrumLayoutMap) => void;
}

interface DragState {
  pointerId: number;
  drumId: DrumType;
  action: 'move' | 'resize';
  startX: number;
  startY: number;
  initialZone: NormalizedZone;
  containerRect: DOMRect;
}

export const CameraView: React.FC<CameraViewProps> = ({
  isCameraActive,
  isCameraInitializing = false,
  cameraError = null,
  onToggleCamera,
  leftHand,
  rightHand,
  zoneEnergies,
  activeHits,
  playbackHits,
  onDrumClick,
  promptedDrum = null,
  mirror = true,
  showHandIndicators = true,
  allowLayoutEditing = true,
  onLayoutChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Layout State
  const [layout, setLayout] = useState<DrumLayoutMap>(() => drumLayoutService.getLayout());
  const [isEditingLayout, setIsEditingLayout] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);

  // Subscribe to external layout changes
  useEffect(() => {
    const unsubscribe = drumLayoutService.subscribe((newLayout) => {
      setLayout(newLayout);
      onLayoutChange?.(newLayout);
    });
    return unsubscribe;
  }, [onLayoutChange]);

  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      cameraTracker.start(videoRef.current).catch((err) => {
        console.warn('Failed to start camera in view:', err);
      });
    }
  }, [isCameraActive]);

  // Handle Drag / Resize pointer interactions
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, drumId: DrumType, action: 'move' | 'resize') => {
      if (!isEditingLayout) return;
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const currentZone = layout[drumId] || DEFAULT_DRUM_LAYOUT[drumId];

      const dragState: DragState = {
        pointerId: e.pointerId,
        drumId,
        action,
        startX: e.clientX,
        startY: e.clientY,
        initialZone: { ...currentZone },
        containerRect,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setActiveDrag(dragState);
    },
    [isEditingLayout, layout]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeDrag || !isEditingLayout) return;
      e.preventDefault();

      const { drumId, action, startX, startY, initialZone, containerRect } = activeDrag;
      if (containerRect.width === 0 || containerRect.height === 0) return;

      const deltaXPercent = ((e.clientX - startX) / containerRect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / containerRect.height) * 100;

      setLayout((prev) => {
        const zone = { ...(prev[drumId] || initialZone) };

        if (action === 'move') {
          // Clamp x and y inside [0, 100 - width] and [0, 100 - height]
          const maxX = 100 - zone.width;
          const maxY = 100 - zone.height;
          zone.x = Math.max(0, Math.min(maxX, Math.round(initialZone.x + deltaXPercent)));
          zone.y = Math.max(0, Math.min(maxY, Math.round(initialZone.y + deltaYPercent)));
        } else if (action === 'resize') {
          // Clamp width between 14% and 45% and within container
          const maxWidth = Math.min(45, 100 - zone.x);
          const maxHeight = Math.min(50, 100 - zone.y);
          zone.width = Math.max(14, Math.min(maxWidth, Math.round(initialZone.width + deltaXPercent)));
          zone.height = Math.max(16, Math.min(maxHeight, Math.round(initialZone.height + deltaYPercent)));
        }

        const next = { ...prev, [drumId]: zone };
        return next;
      });
    },
    [activeDrag, isEditingLayout]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!activeDrag) return;
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      // Sync latest layout with service
      drumLayoutService.setLayout(layout);
      setActiveDrag(null);
    },
    [activeDrag, layout]
  );

  const applyPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const newLayout = drumLayoutService.setPreset(presetId);
    setLayout(newLayout);
  };

  const handleResetDefaults = () => {
    setActivePresetId('default');
    const defaultLayout = drumLayoutService.resetToDefault();
    setLayout(defaultLayout);
  };

  const handleSaveAndClose = () => {
    drumLayoutService.setLayout(layout);
    setIsEditingLayout(false);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[520px] rounded-2xl overflow-hidden border bg-zinc-950 shadow-2xl shadow-black/80 flex items-center justify-center select-none ${
        isEditingLayout ? 'border-amber-500/80 ring-2 ring-amber-500/30' : 'border-zinc-800'
      }`}
    >
      {/* Live Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isCameraActive ? 'opacity-90' : 'opacity-0'
        } ${mirror ? '-scale-x-100' : ''}`}
      />

      {/* Dark Vignette Overlay for maximum readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/40 pointer-events-none" />

      {/* Layout Editor Toolbar Header (Visible when Edit Mode is active) */}
      {isEditingLayout && (
        <div className="absolute top-3 left-3 right-3 z-40 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-950/90 border border-amber-500/40 p-2.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 text-zinc-950 font-black text-[10px] tracking-wider uppercase px-2 py-0.5">
              <Move className="h-3 w-3 mr-1" />
              EDIT LAYOUT
            </Badge>
            <span className="text-[11px] text-zinc-300 hidden sm:inline">
              Drag pads to move • Drag bottom-right corner to resize
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-zinc-900/90 rounded-lg p-0.5 border border-zinc-800">
            {LAYOUT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  activePresetId === p.id
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={p.description}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-7 px-2.5 text-[11px] rounded-lg border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAndClose}
              className="h-7 px-3 text-[11px] font-bold rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 mr-1 stroke-[3]" />
              Save Layout
            </Button>
          </div>
        </div>
      )}

      {/* Drum Pads Overlay (Interactive buttons or Draggable/Resizable pads) */}
      {isCameraActive && (
        <div className="absolute inset-0 pointer-events-none">
          {DRUMS.map((drum) => {
            const zone = layout[drum.id] || drum.visualZone;
            const hitState = activeHits[drum.id];
            const isHit = hitState?.isHit;
            const isPrompted = promptedDrum === drum.id;
            const energy = zoneEnergies[drum.id] || 0;
            const isDraggingThis = activeDrag?.drumId === drum.id;

            if (isEditingLayout) {
              // ============================================
              // EDIT MODE PAD (DRAGGABLE & RESIZABLE)
              // ============================================
              return (
                <div
                  key={drum.id}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                    borderColor: drum.color,
                    backgroundColor: `${drum.color}22`,
                    boxShadow: isDraggingThis
                      ? `0 0 25px ${drum.glowColor}, inset 0 0 15px ${drum.glowColor}`
                      : `0 0 10px ${drum.glowColor}`,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, drum.id, 'move')}
                  className={`absolute z-30 rounded-2xl border-2 border-dashed pointer-events-auto cursor-move flex flex-col items-center justify-between p-2 select-none backdrop-blur-xs transition-shadow ${
                    isDraggingThis ? 'scale-[1.02] ring-2 ring-white z-40' : 'hover:border-solid'
                  }`}
                >
                  {/* Top info badge */}
                  <div className="flex items-center justify-between w-full px-1">
                    <span
                      className="font-black text-xs uppercase tracking-wider"
                      style={{ color: drum.color }}
                    >
                      {drum.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-zinc-950/80 text-[9px] font-mono px-1 py-0 border-zinc-700 text-zinc-300"
                    >
                      {zone.width}×{zone.height}%
                    </Badge>
                  </div>

                  {/* Center drag icon */}
                  <div className="flex flex-col items-center gap-1 text-zinc-300 pointer-events-none">
                    <Move className="h-4 w-4" style={{ color: drum.color }} />
                    <span className="text-[10px] font-mono text-zinc-400">
                      ({zone.x}%, {zone.y}%)
                    </span>
                  </div>

                  {/* Bottom Resize Handle (Bottom-Right Corner) */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, drum.id, 'resize')}
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-xl rounded-tl-lg bg-amber-500 text-zinc-950 flex items-center justify-center cursor-nwse-resize shadow-lg hover:scale-125 transition-transform z-40"
                    title="Drag to resize"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </div>
                </div>
              );
            }

            // ============================================
            // PLAY MODE PAD (TACTILE GESTURE & CLICK TARGET)
            // ============================================
            const isUserHit = Boolean(hitState?.isHit);
            const isPlaybackHit = Boolean(playbackHits?.[drum.id]);
            const isFingerInside = energy > 12;

            const borderCol = isUserHit
              ? '#ffffff'
              : isFingerInside
              ? '#38bdf8'
              : isPlaybackHit
              ? '#34d399'
              : isPrompted
              ? '#ffffff'
              : drum.color;

            const bgCol = isUserHit
              ? drum.glowColor
              : isFingerInside
              ? `${drum.color}55`
              : isPlaybackHit
              ? `${drum.color}35`
              : isPrompted
              ? `${drum.color}38`
              : 'rgba(24, 24, 27, 0.45)';

            const shadowStyle = isUserHit
              ? `0 0 38px ${drum.glowColor}, inset 0 0 20px ${drum.glowColor}`
              : isFingerInside
              ? `0 0 25px ${drum.glowColor}, inset 0 0 15px rgba(56, 189, 248, 0.5)`
              : isPlaybackHit
              ? `0 0 22px rgba(52, 211, 153, 0.7), inset 0 0 12px rgba(52, 211, 153, 0.3)`
              : isPrompted
              ? `0 0 28px ${drum.glowColor}, inset 0 0 22px ${drum.glowColor}`
              : 'none';

            return (
              <Button
                key={drum.id}
                type="button"
                variant="ghost"
                onClick={() => onDrumClick?.(drum.id)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onDrumClick?.(drum.id);
                }}
                title={drum.name}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  borderColor: borderCol,
                  backgroundColor: bgCol,
                  boxShadow: shadowStyle,
                }}
                className={`absolute z-10 rounded-2xl border-2 pointer-events-auto cursor-pointer transition-transform duration-100 flex flex-col items-center justify-center p-2 select-none hover:border-cyan-400 hover:ring-2 hover:ring-cyan-500/40 ${
                  isUserHit
                    ? 'scale-95 ring-2 ring-white z-20'
                    : isFingerInside
                    ? 'scale-[1.03] ring-2 ring-cyan-400 z-20'
                    : isPlaybackHit
                    ? 'scale-[1.02] ring-2 ring-emerald-400/80'
                    : isPrompted
                    ? 'scale-[1.03] ring-4 ring-white/60'
                    : 'hover:scale-[1.02]'
                }`}
              >
                {/* 1. User Live Hit Badge */}
                {isUserHit && (
                  <div
                    className="absolute -top-3 z-30 font-black text-[11px] sm:text-xs uppercase px-2 py-0.5 rounded-full text-zinc-950 shadow-lg animate-bounce pointer-events-none"
                    style={{ backgroundColor: drum.color }}
                  >
                    {hitState?.rating ? hitState.rating.toUpperCase() : 'HIT!'}
                  </div>
                )}

                {/* 2. Finger Targeting Indicator (Always visible when index finger is inside zone) */}
                {isFingerInside && !isUserHit && (
                  <div className="absolute -top-3 z-30 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-950 bg-cyan-300 shadow-lg pointer-events-none animate-pulse">
                    Targeted
                  </div>
                )}

                {/* 3. Backing Loop Playback Beat Indicator */}
                {isPlaybackHit && !isUserHit && !isFingerInside && (
                  <div className="absolute -top-3 z-30 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-950 bg-emerald-300 shadow-md pointer-events-none animate-pulse">
                    Loop Beat
                  </div>
                )}

                {/* 4. Prompted Drum Indicator */}
                {isPrompted && !isUserHit && !isFingerInside && !isPlaybackHit && (
                  <div
                    className="absolute -top-3 z-30 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-950 shadow-lg pointer-events-none"
                    style={{ backgroundColor: drum.color }}
                  >
                    Play this
                  </div>
                )}

                <div className="flex flex-col items-center pointer-events-none">
                  <span
                    className="font-black text-xs sm:text-sm tracking-wide uppercase drop-shadow"
                    style={{ color: isUserHit ? '#ffffff' : drum.color }}
                  >
                    {drum.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-300/80 font-medium hidden sm:block">
                    Key [{drum.key}]
                  </span>
                </div>

                {/* Energy indicator inside drum */}
                <div className="w-14 sm:w-20 h-1 bg-zinc-800/80 rounded-full mt-1.5 overflow-hidden pointer-events-none">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, isFingerInside ? Math.max(45, energy) : energy)}%`,
                      backgroundColor: isFingerInside ? '#38bdf8' : isPlaybackHit ? '#34d399' : drum.color,
                    }}
                  />
                </div>
              </Button>
            );
          })}

          {/* Real-time Hand Position Trackers */}
          {showHandIndicators && (
            <>
              {/* Left Hand Indicator */}
              {leftHand.isActive && (
                <div
                  style={{
                    left: `${leftHand.x}%`,
                    top: `${leftHand.y}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center will-change-[left,top]"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-cyan-400 bg-cyan-400/20 shadow-[0_0_20px_rgba(6,182,212,0.6)]" />
                    <div className="absolute h-2 w-2 rounded-full bg-cyan-300" />
                  </div>
                  <span className="text-[9px] font-bold text-cyan-300 bg-zinc-950/80 px-1.5 py-0.5 rounded mt-1 border border-cyan-500/30">
                    Index
                  </span>
                </div>
              )}

              {/* Right Hand Indicator */}
              {rightHand.isActive && (
                <div
                  style={{
                    left: `${rightHand.x}%`,
                    top: `${rightHand.y}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center will-change-[left,top]"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-rose-400 bg-rose-400/20 shadow-[0_0_20px_rgba(244,63,94,0.6)]" />
                    <div className="absolute h-2 w-2 rounded-full bg-rose-300" />
                  </div>
                  <span className="text-[9px] font-bold text-rose-300 bg-zinc-950/80 px-1.5 py-0.5 rounded mt-1 border border-rose-500/30">
                    Index
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Camera Inactive Placeholder */}
      {!isCameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-zinc-950/95 backdrop-blur-md">
          <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
            <Camera className="h-8 w-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">
            MediaPipe Hand Tracking Ready
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            Move an index fingertip onto a drum to play it.
            You can also click a drum or use keyboard shortcuts anytime!
          </p>
          {cameraError && (
            <Alert variant="destructive" className="mb-4 max-w-md border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertDescription className="text-xs text-rose-200">{cameraError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              id="camera-start-btn"
              type="button"
              size="lg"
              onClick={onToggleCamera}
              disabled={isCameraInitializing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-rose-500/25 transition-transform hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100 cursor-pointer"
            >
              {isCameraInitializing ? (
                <RefreshCw className="h-4 w-4 animate-spin stroke-[2.5]" />
              ) : (
                <Camera className="h-4 w-4 stroke-[2.5]" />
              )}
              {isCameraInitializing ? 'Starting Camera...' : 'Start Webcam'}
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-zinc-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% Private: All tracking is calculated locally in your browser.
          </p>
        </div>
      )}

      {/* Camera Live Controls Floating Bar */}
      {isCameraActive && !isEditingLayout && (
        <div className="absolute bottom-3 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          <Badge variant="outline" className="h-auto gap-2 rounded-lg border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-xs font-normal text-zinc-300 backdrop-blur pointer-events-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px]">MediaPipe Index Tracking</span>
          </Badge>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Edit Layout Button */}
            {allowLayoutEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingLayout(true)}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/50 text-amber-300 px-2.5 py-1 text-xs font-semibold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                title="Customize Drum Pad Positions and Sizes"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span>Edit Layout</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleCamera}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors shadow cursor-pointer"
              title="Stop Camera"
            >
              <CameraOff className="h-3.5 w-3.5 text-rose-400" />
              <span>Stop Cam</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
