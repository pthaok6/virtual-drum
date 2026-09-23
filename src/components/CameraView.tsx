import React, { useEffect, useRef } from 'react';
import { DRUMS } from '../data/drums';
import { DrumType, HitRating } from '../types';
import { cameraTracker, HandPosition } from '../services/cameraTracker';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

interface CameraViewProps {
  isCameraActive: boolean;
  isCameraInitializing?: boolean;
  cameraError?: string | null;
  onToggleCamera: () => void;
  leftHand: HandPosition;
  rightHand: HandPosition;
  zoneEnergies: Record<DrumType, number>;
  activeHits: Record<DrumType, { isHit: boolean; rating?: HitRating }>;
  onDrumClick?: (drum: DrumType) => void;
  promptedDrum?: DrumType | null;
  mirror?: boolean;
  showHandIndicators?: boolean;
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
  onDrumClick,
  promptedDrum = null,
  mirror = true,
  showHandIndicators = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      cameraTracker.start(videoRef.current).catch((err) => {
        console.warn('Failed to start camera in view:', err);
      });
    }
  }, [isCameraActive]);

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[520px] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/80 flex items-center justify-center">
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

      {/* Visible drums are also the exact gesture and click targets. */}
      {isCameraActive && (
        <div className="absolute inset-0 pointer-events-none">
          {DRUMS.map((drum) => {
            const hitState = activeHits[drum.id];
            const isHit = hitState?.isHit;
            const isPrompted = promptedDrum === drum.id;
            const energy = zoneEnergies[drum.id] || 0;

            return (
              <div
                key={drum.id}
                onClick={() => onDrumClick?.(drum.id)}
                title={drum.name}
                style={{
                  left: `${drum.visualZone.x}%`,
                  top: `${drum.visualZone.y}%`,
                  width: `${drum.visualZone.width}%`,
                  height: `${drum.visualZone.height}%`,
                  borderColor: isHit || isPrompted ? '#ffffff' : drum.color,
                  backgroundColor: isHit
                    ? drum.glowColor
                    : isPrompted
                    ? `${drum.color}38`
                    : energy > 30
                    ? `${drum.color}2e`
                    : 'rgba(24, 24, 27, 0.45)',
                  boxShadow: isHit
                    ? `0 0 35px ${drum.glowColor}`
                    : isPrompted
                    ? `0 0 28px ${drum.glowColor}, inset 0 0 22px ${drum.glowColor}`
                    : energy > 40
                    ? `0 0 15px ${drum.glowColor}`
                    : 'none',
                }}
                className={`absolute z-10 rounded-2xl border-2 pointer-events-auto cursor-pointer transition-transform duration-100 flex flex-col items-center justify-center p-2 select-none ${
                  isHit ? 'scale-95' : isPrompted ? 'scale-[1.03] ring-4 ring-white/60' : 'hover:scale-[1.02]'
                }`}
              >
                {isPrompted && !isHit && (
                  <div
                    className="absolute -top-3 z-30 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-950 shadow-lg"
                    style={{ backgroundColor: drum.color }}
                  >
                    Play this
                  </div>
                )}

                {/* Hit badge popup */}
                {isHit && (
                  <div
                    className="absolute -top-3 z-30 font-black text-[11px] sm:text-xs uppercase px-2 py-0.5 rounded-full text-zinc-950 shadow-lg animate-bounce"
                    style={{ backgroundColor: drum.color }}
                  >
                    {hitState?.rating ? hitState.rating.toUpperCase() : 'HIT!'}
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <span
                    className="font-black text-xs sm:text-sm tracking-wide uppercase drop-shadow"
                    style={{ color: isHit ? '#ffffff' : drum.color }}
                  >
                    {drum.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-300/80 font-medium hidden sm:block">
                    Key [{drum.key}]
                  </span>
                </div>

                {/* Shows when an index fingertip is inside this drum. */}
                <div className="w-14 sm:w-20 h-1 bg-zinc-800/80 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, energy)}%`,
                      backgroundColor: drum.color,
                    }}
                  />
                </div>
              </div>
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
            <div role="alert" className="mb-4 max-w-md rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {cameraError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="camera-start-btn"
              onClick={onToggleCamera}
              disabled={isCameraInitializing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-rose-500/25 transition-transform hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100"
            >
              {isCameraInitializing ? (
                <RefreshCw className="h-4 w-4 animate-spin stroke-[2.5]" />
              ) : (
                <Camera className="h-4 w-4 stroke-[2.5]" />
              )}
              {isCameraInitializing ? 'Starting Camera...' : 'Start Webcam'}
            </button>
          </div>
          <p className="mt-4 text-[11px] text-zinc-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% Private: All tracking is calculated locally in your browser.
          </p>
        </div>
      )}

      {/* Camera Live Controls Floating Bar */}
      {isCameraActive && (
        <div className="absolute bottom-3 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 pointer-events-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px]">MediaPipe Index Tracking</span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onToggleCamera}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors shadow"
              title="Stop Camera"
            >
              <CameraOff className="h-3.5 w-3.5 text-rose-400" />
              <span>Stop Cam</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
