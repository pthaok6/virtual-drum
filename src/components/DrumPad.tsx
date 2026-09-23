import React from 'react';
import { DrumInfo, HitRating } from '../types';

interface DrumPadProps {
  drum: DrumInfo;
  isHit: boolean;
  hitRating?: HitRating;
  isPrompted?: boolean;
  energyPercent?: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const DrumPad: React.FC<DrumPadProps> = ({
  drum,
  isHit,
  hitRating,
  isPrompted = false,
  energyPercent = 0,
  onClick,
  size = 'md',
}) => {
  const isCymbal = drum.id === 'hihat' || drum.id === 'crash';

  const sizeClasses = {
    sm: 'h-24 w-24 sm:h-28 sm:w-28 text-xs',
    md: 'h-32 w-32 sm:h-36 sm:w-36 md:h-40 md:w-40 text-sm',
    lg: 'h-40 w-40 sm:h-48 sm:w-48 text-base',
  }[size];

  return (
    <div className="relative flex flex-col items-center justify-center select-none group">
      {/* Floating HIT feedback */}
      {isHit && (
        <div
          className="absolute -top-7 pointer-events-none z-30 animate-bounce flex items-center gap-1 font-black text-xs sm:text-sm tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-lg"
          style={{
            backgroundColor: drum.color,
            color: '#09090b',
            boxShadow: `0 0 20px ${drum.glowColor}`,
          }}
        >
          {hitRating ? hitRating.toUpperCase() : 'HIT!'}
        </div>
      )}

      {isPrompted && !isHit && (
        <div
          className="absolute -top-7 z-30 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-950 shadow-lg"
          style={{ backgroundColor: drum.color }}
        >
          Play this
        </div>
      )}

      {/* Ripple wave ring on hit */}
      {isHit && (
        <div
          className="absolute inset-0 rounded-full animate-ping pointer-events-none border-2 z-10"
          style={{
            borderColor: drum.color,
            opacity: 0.6,
          }}
        />
      )}

      {/* Main Drum / Cymbal Body */}
      <button
        id={`drum-pad-${drum.id}`}
        type="button"
        onClick={onClick}
        style={{
          boxShadow: isHit
            ? `0 0 35px ${drum.glowColor}, inset 0 0 25px ${drum.glowColor}`
            : isPrompted
            ? `0 0 30px ${drum.glowColor}, inset 0 0 20px ${drum.glowColor}`
            : '0 10px 25px -5px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.05)',
        }}
        className={`relative ${sizeClasses} rounded-full cursor-pointer transition-all duration-75 flex flex-col items-center justify-center p-3 text-center border-2 ${
          isHit
            ? 'scale-95 border-white bg-zinc-800'
            : isPrompted
            ? 'scale-[1.04] border-white bg-zinc-800 ring-4 ring-white/50'
            : isCymbal
            ? 'border-zinc-700/80 bg-gradient-to-b from-zinc-800 to-zinc-950 hover:border-zinc-500 hover:scale-[1.02]'
            : 'border-zinc-700/80 bg-gradient-to-b from-zinc-900 to-zinc-950 hover:border-zinc-500 hover:scale-[1.02]'
        }`}
      >
        {/* Cymbal concentric grooves or Drum Head Rim */}
        {isCymbal ? (
          <div className="absolute inset-2 rounded-full border border-amber-500/20 pointer-events-none">
            <div className="absolute inset-3 rounded-full border border-amber-500/20" />
            <div className="absolute inset-5 rounded-full border border-amber-500/30" />
            {/* Center Bell */}
            <div className="absolute inset-0 m-auto h-5 w-5 rounded-full bg-amber-400/30 border border-amber-300/40" />
          </div>
        ) : (
          <div className="absolute inset-2 rounded-full border border-zinc-700/40 bg-zinc-900/40 pointer-events-none">
            {/* Subtle cross skin ring */}
            <div className="absolute inset-0 m-auto h-8 w-8 rounded-full border border-dashed border-zinc-700/60" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <span
            className="font-black tracking-wide text-white uppercase text-sm sm:text-base drop-shadow-md"
            style={{ color: isHit ? '#ffffff' : drum.color }}
          >
            {drum.name}
          </span>
          <span className="text-[10px] sm:text-[11px] font-medium text-zinc-400">
            {drum.subtitle}
          </span>

          {/* Key shortcut pill */}
          <div className="mt-1.5 flex items-center gap-1 rounded bg-zinc-900/90 border border-zinc-700/60 px-1.5 py-0.5 text-[9px] font-mono font-bold text-zinc-300 shadow-inner">
            KEY: {drum.key}
          </div>
        </div>

        {/* Energy bar ring / meter at bottom of pad */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-75 rounded-full"
            style={{
              width: `${Math.min(100, energyPercent)}%`,
              backgroundColor: drum.color,
            }}
          />
        </div>
      </button>
    </div>
  );
};
