import React, { useRef, useEffect } from 'react';
import { DrumType, RecordedHit } from '../types';
import { DRUMS } from '../data/drums';
import {
  Circle,
  Square,
  Play,
  Pause,
  Layers,
  Trash2,
  Disc3,
  Gauge,
  Scissors,
  Radio,
  Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LooperControlProps {
  isRecording: boolean;
  isArmed?: boolean;
  isPlaying: boolean;
  isOverdubbing: boolean;
  recordedHits: RecordedHit[];
  loopDurationMs: number;
  currentPlayheadMs: number;
  recordingElapsedMs: number;
  playbackSpeed: number;
  isLoopMode?: boolean;
  trimFeedback?: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTogglePlay: () => void;
  onToggleOverdub: () => void;
  onToggleLoopMode?: () => void;
  onClearLoop: () => void;
  onSpeedChange: (speed: number) => void;
  onTrimLoop?: () => void;
}

export const LooperControl: React.FC<LooperControlProps> = ({
  isRecording,
  isArmed = false,
  isPlaying,
  isOverdubbing,
  recordedHits,
  loopDurationMs,
  currentPlayheadMs,
  recordingElapsedMs,
  playbackSpeed,
  isLoopMode = false,
  trimFeedback = null,
  onStartRecording,
  onStopRecording,
  onTogglePlay,
  onToggleOverdub,
  onToggleLoopMode,
  onClearLoop,
  onSpeedChange,
  onTrimLoop,
}) => {
  const hasLoop = recordedHits.length > 0 && loopDurationMs > 0;
  const playheadScrubberRef = useRef<HTMLDivElement | null>(null);

  // Calculate actual silence between last hit and end of loop
  const maxHitTimestamp =
    recordedHits.length > 0 ? Math.max(...recordedHits.map((h) => h.timestampMs)) : 0;
  const tailSilenceMs = Math.max(0, loopDurationMs - maxHitTimestamp);
  const hasSignificantTailSilence = hasLoop && tailSilenceMs > 250;

  // Format millisecond timer into mm:ss.d
  const formatTime = (ms: number) => {
    const totalSec = Math.max(0, ms) / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    return `${mins < 10 ? '0' : ''}${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}s`;
  };

  // Direct zero-latency DOM update for the playhead to bypass React reconciliation lag
  useEffect(() => {
    if (!playheadScrubberRef.current) return;
    if (isPlaying && loopDurationMs > 0) {
      const pct = Math.min(100, Math.max(0, (currentPlayheadMs / loopDurationMs) * 100));
      playheadScrubberRef.current.style.left = `${pct}%`;
    } else if (isRecording && recordingElapsedMs > 0) {
      // In live recording, the playhead is at the right edge of elapsed time
      playheadScrubberRef.current.style.left = '100%';
    }
  }, [currentPlayheadMs, loopDurationMs, isPlaying, isRecording, recordingElapsedMs]);

  // Determine timeline duration to scale hits
  const timelineDuration = isRecording
    ? Math.max(2000, recordingElapsedMs)
    : loopDurationMs > 0
    ? loopDurationMs
    : 1000;

  return (
    <Card className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl backdrop-blur-md">
      {/* Top Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isRecording
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                : isArmed
                ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/40 animate-bounce'
                : isPlaying
                ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
            }`}
          >
            {isArmed ? (
              <Radio className="h-5 w-5 animate-pulse" />
            ) : (
              <Disc3 className={`h-5 w-5 ${isPlaying ? 'animate-spin' : ''}`} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Beat Looper & Live Recorder
              </h2>
              {trimFeedback ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] animate-pulse">
                  {trimFeedback}
                </Badge>
              ) : isArmed ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] animate-pulse">
                  ARMED (WAITING FOR 1ST HIT...)
                </Badge>
              ) : isRecording ? (
                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] animate-pulse">
                  REC {formatTime(recordingElapsedMs)}
                </Badge>
              ) : isOverdubbing ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] animate-pulse">
                  OVERDUB ACTIVE
                </Badge>
              ) : isPlaying ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {isLoopMode ? `LOOPING ${playbackSpeed}x` : `PLAYING 1X (${playbackSpeed}x)`}
                </Badge>
              ) : hasLoop ? (
                <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">
                  READY ({recordedHits.length} HITS)
                </Badge>
              ) : (
                <Badge className="bg-zinc-900 text-zinc-500 border-zinc-800 text-[10px]">
                  IDLE
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isArmed
                ? 'Hit any drum pad or press any key to instantly start recording with 0ms delay!'
                : 'Record live gestures, create loops, and jam over multiple layers in real-time'}
            </p>
          </div>
        </div>

        {/* Speed presets (0.75x, 1x, 1.25x) */}
        <div className="flex items-center gap-1.5 bg-zinc-900/90 rounded-xl border border-zinc-800 p-1">
          <Gauge className="h-3.5 w-3.5 text-zinc-400 ml-1.5" />
          {[0.75, 1.0, 1.25].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onSpeedChange(spd)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                playbackSpeed === spd
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Record / Stop Button */}
          {isRecording || isArmed ? (
            <Button
              type="button"
              size="sm"
              onClick={onStopRecording}
              className="rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-2 px-4 py-2 hover:bg-rose-500 shadow-lg shadow-rose-600/30 animate-pulse cursor-pointer"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>
                {isArmed
                  ? 'Cancel Record'
                  : `Stop & Save Loop (${formatTime(recordingElapsedMs)})`}
              </span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onStartRecording}
              className="rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold text-xs flex items-center gap-2 px-4 py-2 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 cursor-pointer"
            >
              <Circle className="h-3.5 w-3.5 fill-rose-300" />
              <span>Record New Loop</span>
            </Button>
          )}

          {/* Play / Pause Button */}
          {hasLoop && !isRecording && !isArmed && (
            <Button
              type="button"
              size="sm"
              onClick={onTogglePlay}
              className={`rounded-xl font-bold text-xs flex items-center gap-2 px-4 py-2 transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{isLoopMode ? 'Play Loop' : 'Play Once (1x)'}</span>
                </>
              )}
            </Button>
          )}

          {/* Repeat / Loop Mode Toggle */}
          {hasLoop && !isRecording && !isArmed && onToggleLoopMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleLoopMode}
              className={`rounded-xl text-xs font-bold flex items-center gap-1.5 px-3 py-2 transition-all cursor-pointer ${
                isLoopMode
                  ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title={isLoopMode ? 'Continuous Loop active. Click to switch to Single Playback (Play Once).' : 'Single Playback active (plays once). Click to switch to Continuous Loop.'}
            >
              <Repeat className={`h-3.5 w-3.5 ${isLoopMode ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>{isLoopMode ? 'Loop: Continuous' : 'Play Once'}</span>
            </Button>
          )}

          {/* Overdub (Layering) Button */}
          {hasLoop && !isRecording && !isArmed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleOverdub}
              className={`rounded-xl text-xs font-bold flex items-center gap-1.5 px-3 py-2 transition-all cursor-pointer ${
                isOverdubbing
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>{isOverdubbing ? 'Overdubbing (Layer ON)' : 'Overdub Layer'}</span>
            </Button>
          )}

          {/* Trim Tail Silence Button */}
          {hasLoop && !isRecording && !isArmed && onTrimLoop && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTrimLoop}
              className={`rounded-xl text-xs font-bold flex items-center gap-1.5 px-3 py-2 transition-all cursor-pointer ${
                hasSignificantTailSilence
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:bg-amber-500/30'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-300'
              }`}
              title={
                hasSignificantTailSilence
                  ? `Cut ${(tailSilenceMs / 1000).toFixed(1)}s of dead silence after the final drum hit`
                  : 'Tail is already tight (no dead silence)'
              }
            >
              <Scissors className={`h-3.5 w-3.5 ${hasSignificantTailSilence ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
              <span>
                {hasSignificantTailSilence
                  ? `Trim Tail (-${(tailSilenceMs / 1000).toFixed(1)}s)`
                  : 'Tail Tight ✓'}
              </span>
            </Button>
          )}
        </div>

        {/* Clear Loop Button */}
        {hasLoop && !isRecording && !isArmed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearLoop}
            className="rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Loop</span>
          </Button>
        )}
      </div>

      {/* Visual Timeline Loop Strip (Shown during recording, overdubbing, and loop playback) */}
      {(hasLoop || isRecording || isArmed) && (
        <div className="relative mt-1 flex flex-col gap-1.5">
          <div className="relative h-11 w-full overflow-hidden rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-inner">
            {/* Horizontal center guideline */}
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-zinc-800/80 -translate-y-1/2 pointer-events-none" />

            {/* Note tick markers recorded along the timeline */}
            {recordedHits.map((hit) => {
              const drum = DRUMS.find((d) => d.id === hit.drum);
              const leftPercent = Math.min(
                100,
                Math.max(0, (hit.timestampMs / timelineDuration) * 100)
              );

              return (
                <div
                  key={hit.id}
                  style={{
                    left: `${leftPercent}%`,
                    backgroundColor: drum ? drum.color : '#f43f5e',
                    boxShadow: drum ? `0 0 10px ${drum.glowColor}` : undefined,
                  }}
                  title={`${drum?.name || hit.drum} (${Math.round(hit.velocity * 100)}% vel)`}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-2 sm:w-2.5 rounded-sm z-10 animate-in fade-in zoom-in-75 duration-100"
                />
              );
            })}

            {/* Zero-delay Playhead / Recording Scrubber line (No CSS transition lag!) */}
            <div
              ref={playheadScrubberRef}
              style={{
                left: isPlaying && loopDurationMs > 0
                  ? `${Math.min(100, Math.max(0, (currentPlayheadMs / loopDurationMs) * 100))}%`
                  : isRecording
                  ? '100%'
                  : '0%',
              }}
              className={`absolute top-0 bottom-0 w-1 -translate-x-1/2 z-20 will-change-[left] pointer-events-none ${
                isRecording
                  ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                  : isPlaying
                  ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]'
                  : 'hidden'
              }`}
            >
              <div
                className={`absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full ${
                  isRecording ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-white shadow-[0_0_8px_white]'
                }`}
              />
            </div>
          </div>

          {/* Time & Instruments Legend footer */}
          <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 font-mono">
            <span>00:00.0</span>
            <div className="flex items-center gap-3 font-sans">
              {DRUMS.map((d) => (
                <div key={d.id} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-zinc-400">{d.name}</span>
                </div>
              ))}
            </div>
            <span>
              {isRecording
                ? formatTime(recordingElapsedMs)
                : formatTime(loopDurationMs)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
