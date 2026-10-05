import React from 'react';
import { DRUMS } from '../data/drums';
import { BeatNote, DrumType, HitRating } from '../types';
import { Flame, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FallingNoteLaneProps {
  notes: BeatNote[];
  currentTimeMs: number;
  bpm: number;
  combo: number;
  lastHitFeedback?: {
    drum: DrumType;
    rating: HitRating;
  } | null;
  activeHits?: Record<DrumType, { isHit: boolean; rating?: HitRating }>;
  onDrumClick?: (drum: DrumType) => void;
}

const LANE_DRUMS: DrumType[] = ['snare', 'kick', 'hihat', 'tom', 'crash'];

export const FallingNoteLane: React.FC<FallingNoteLaneProps> = ({
  notes,
  currentTimeMs,
  bpm,
  combo,
  lastHitFeedback,
  activeHits,
  onDrumClick,
}) => {
  // Anticipation window: notes become visible 1000ms ahead, stay 200ms past
  const lookAheadMs = 1200;
  const lookBehindMs = 250;
  // Hit line is positioned at 82% from top of the lane
  const hitLinePercent = 82;

  // Filter notes in current time slice
  const activeNotes = notes.filter(
    (n) => n.timeMs >= currentTimeMs - lookBehindMs && n.timeMs <= currentTimeMs + lookAheadMs
  );

  return (
    <div className="relative flex flex-col w-full h-48 sm:h-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md overflow-hidden select-none">
      {/* Top Header Information */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
          <span className="font-bold uppercase tracking-wider text-zinc-300 text-[11px]">
            Beat Highway
          </span>
          <Badge variant="outline" className="rounded bg-zinc-900 border-zinc-700 px-1.5 py-0 font-mono text-[10px] text-zinc-300">
            {bpm} BPM
          </Badge>
        </div>

        {/* Real-time Combo & Rating feedback banner */}
        <div className="flex items-center gap-2">
          {combo > 2 && (
            <div className="flex items-center gap-1 font-mono text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 animate-pulse">
              <Flame className="h-3 w-3 fill-amber-400" />
              <span>{combo} COMBO</span>
            </div>
          )}
          {lastHitFeedback && (
            <span
              className={`font-black text-xs uppercase px-2 py-0.5 rounded-md ${
                lastHitFeedback.rating === 'perfect'
                  ? 'bg-amber-400 text-zinc-950 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                  : lastHitFeedback.rating === 'good'
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {lastHitFeedback.rating}
            </span>
          )}
        </div>
      </div>

      {/* Main Falling Highway Body */}
      <div className="relative flex-1 w-full grid grid-cols-5 gap-1 mt-1 overflow-hidden rounded-xl bg-gradient-to-b from-zinc-900/40 via-zinc-900/80 to-zinc-950 border border-zinc-800/50">
        {/* Strike / Target Line Bar (Horizontal) */}
        <div
          style={{ top: `${hitLinePercent}%` }}
          className="absolute left-0 right-0 h-1 -translate-y-1/2 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 z-20 shadow-[0_0_15px_rgba(244,63,94,0.9)] flex items-center justify-between px-2"
        >
          <span className="text-[8px] font-black uppercase text-amber-300 bg-zinc-950/90 px-1 rounded -translate-y-3">
            STRIKE ZONE
          </span>
          <span className="text-[8px] font-black uppercase text-amber-300 bg-zinc-950/90 px-1 rounded -translate-y-3">
            0.0s
          </span>
        </div>

        {/* 5 Distinct Instrument Lanes */}
        {LANE_DRUMS.map((drumId, colIdx) => {
          const drum = DRUMS.find((d) => d.id === drumId)!;
          const isDrumCurrentlyHit = activeHits?.[drumId]?.isHit;

          return (
            <div
              key={drumId}
              onClick={() => onDrumClick && onDrumClick(drumId)}
              className={`relative h-full flex flex-col items-center border-r border-zinc-800/40 last:border-r-0 cursor-pointer transition-colors ${
                isDrumCurrentlyHit ? 'bg-white/5' : 'hover:bg-zinc-800/20'
              }`}
            >
              {/* Lane Column Header / Key hint */}
              <div className="absolute top-1 text-[9px] font-bold text-zinc-500 uppercase">
                {drum.name}
              </div>

              {/* Receptor target ring at the strike line */}
              <div
                style={{
                  top: `${hitLinePercent}%`,
                  borderColor: isDrumCurrentlyHit ? '#ffffff' : drum.color,
                  boxShadow: isDrumCurrentlyHit ? `0 0 20px ${drum.color}` : 'none',
                }}
                className={`absolute -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-2 flex items-center justify-center font-black text-xs transition-all z-20 ${
                  isDrumCurrentlyHit
                    ? 'scale-125 border-white bg-white text-zinc-950 shadow-[0_0_20px_white]'
                    : 'border-zinc-700 bg-zinc-900/90 text-zinc-400'
                }`}
              >
                {drum.key}
              </div>

              {/* Falling Notes for this drum */}
              {activeNotes
                .filter((n) => n.drum === drumId)
                .map((note) => {
                  const timeDiff = note.timeMs - currentTimeMs; // in ms
                  // When timeDiff == 0 => top = hitLinePercent
                  // When timeDiff == lookAheadMs => top = 0%
                  const topPercent = hitLinePercent - (timeDiff / lookAheadMs) * hitLinePercent;

                  return (
                    <div
                      key={note.id}
                      style={{
                        top: `${topPercent}%`,
                        opacity: note.hit ? 0.25 : 1,
                        transform: `translateY(-50%) scale(${note.hit ? 0.8 : 1})`,
                      }}
                      className="absolute z-10 flex flex-col items-center pointer-events-none transition-transform"
                    >
                      <div
                        className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center text-xs font-black text-zinc-950 shadow-lg border border-white/80 transition-all ${
                          note.hit ? 'brightness-50' : 'animate-pulse'
                        }`}
                        style={{
                          backgroundColor: drum.color,
                          boxShadow: `0 0 16px ${drum.glowColor}`,
                        }}
                      >
                        {drum.name.slice(0, 1)}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
