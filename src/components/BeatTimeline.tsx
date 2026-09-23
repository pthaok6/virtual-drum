import React from 'react';
import { DRUMS } from '../data/drums';
import { BeatNote, DrumType, HitRating } from '../types';

interface BeatTimelineProps {
  notes: BeatNote[];
  currentTimeMs: number;
  bpm: number;
  lastHitFeedback?: {
    drum: DrumType;
    rating: HitRating;
    combo: number;
  } | null;
}

export const BeatTimeline: React.FC<BeatTimelineProps> = ({
  notes,
  currentTimeMs,
  bpm,
  lastHitFeedback,
}) => {
  // Timeline window: notes visible within next 2.2 seconds and past 0.4 seconds
  const lookAheadMs = 2200;
  const lookBehindMs = 400;
  const totalWindowMs = lookAheadMs + lookBehindMs;

  // The hit line position in percentage from left (e.g. 20%)
  const hitLinePercent = 20;

  // Filter notes in current window
  const visibleNotes = notes.filter(
    (n) => n.timeMs >= currentTimeMs - lookBehindMs && n.timeMs <= currentTimeMs + lookAheadMs
  );

  return (
    <div className="relative w-full rounded-xl border border-zinc-800 bg-zinc-950/90 backdrop-blur-md p-3 shadow-xl overflow-hidden">
      {/* Background timeline grid bars */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Rhythm Conveyor
          </span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
            {bpm} BPM
          </span>
        </div>

        {/* Real-time Hit Rating Feedback Tag */}
        {lastHitFeedback && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black text-xs uppercase tracking-wider animate-scale ${
              lastHitFeedback.rating === 'perfect'
                ? 'bg-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                : lastHitFeedback.rating === 'good'
                ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                : 'bg-rose-500 text-white'
            }`}
          >
            <span>{lastHitFeedback.rating}</span>
            {lastHitFeedback.combo > 1 && (
              <span className="text-[10px] opacity-80">x{lastHitFeedback.combo}</span>
            )}
          </div>
        )}
      </div>

      {/* Main Track Trackway */}
      <div className="relative h-16 w-full rounded-lg bg-zinc-900/90 border border-zinc-800/80 overflow-hidden">
        {/* Subtle Horizontal Track Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-800 -translate-y-1/2" />

        {/* Target Hit Line (Striking Zone) */}
        <div
          style={{ left: `${hitLinePercent}%` }}
          className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 via-amber-300 to-rose-400 z-20 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
        >
          {/* Target Zone Header Pill */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-1.5 py-0.2 text-[8px] font-black text-zinc-950 uppercase tracking-tighter">
            HIT
          </div>
          {/* Target Circle reticle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border-2 border-amber-300/80 pointer-events-none" />
        </div>

        {/* Dynamic Beat Notes traveling right to left */}
        {visibleNotes.map((note) => {
          const drum = DRUMS.find((d) => d.id === note.drum);
          if (!drum) return null;

          // Calculate horizontal offset
          // When note.timeMs === currentTimeMs, position is hitLinePercent
          const timeDiff = note.timeMs - currentTimeMs;
          const posPercent = hitLinePercent + (timeDiff / lookAheadMs) * (100 - hitLinePercent);

          return (
            <div
              key={note.id}
              style={{
                left: `${posPercent}%`,
                opacity: note.hit ? 0.3 : 1,
                transform: `translate(-50%, -50%) scale(${note.hit ? 0.85 : 1})`,
              }}
              className="absolute top-1/2 transition-transform duration-75 z-10 flex flex-col items-center select-none"
            >
              <div
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center font-black text-xs uppercase shadow-lg border-2 transition-all ${
                  note.hit
                    ? 'border-zinc-700 bg-zinc-800 text-zinc-500'
                    : 'text-zinc-950'
                }`}
                style={{
                  backgroundColor: note.hit ? undefined : drum.color,
                  borderColor: note.hit ? undefined : '#ffffff',
                  boxShadow: note.hit ? 'none' : `0 0 15px ${drum.glowColor}`,
                }}
              >
                {drum.name.slice(0, 2)}
              </div>
              <span className="text-[9px] font-bold text-zinc-300 mt-0.5">
                {drum.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Quick Legend of Upcoming Drum Colors */}
      <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-1">
        <span className="hidden sm:inline">Timing: Strike zone when icon reaches the glowing HIT line!</span>
        <div className="flex items-center gap-3">
          {DRUMS.map((d) => (
            <div key={d.id} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-zinc-300 text-[10px]">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
