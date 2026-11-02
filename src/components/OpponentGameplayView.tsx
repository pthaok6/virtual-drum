import React from 'react';
import type { DrumType, HitRating } from '../types';
import type { OpponentState } from '../hooks/useMultiplayerGame';
import { useLanguage } from '../i18n/LanguageProvider';
import { Crown, Flame, Target, Zap, ShieldAlert, Award, Activity, Swords } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface OpponentGameplayViewProps {
  opponent: OpponentState | null;
  opponentName?: string;
  myScore: number;
  totalNotes: number;
}

const DRUM_COLORS: Record<DrumType, { name: string; color: string; border: string; glow: string }> = {
  hihat: { name: 'Hi-Hat', color: 'bg-amber-400', border: 'border-amber-400', glow: 'rgba(251, 191, 36, 0.5)' },
  tom: { name: 'Tom', color: 'bg-emerald-400', border: 'border-emerald-400', glow: 'rgba(52, 211, 153, 0.5)' },
  crash: { name: 'Crash', color: 'bg-rose-500', border: 'border-rose-500', glow: 'rgba(244, 63, 94, 0.5)' },
  snare: { name: 'Snare', color: 'bg-cyan-400', border: 'border-cyan-400', glow: 'rgba(34, 211, 238, 0.5)' },
  kick: { name: 'Kick', color: 'bg-violet-400', border: 'border-violet-400', glow: 'rgba(167, 139, 250, 0.5)' },
};

export const OpponentGameplayView: React.FC<OpponentGameplayViewProps> = ({
  opponent,
  opponentName = 'Opponent',
  myScore,
  totalNotes,
}) => {
  const { t, locale } = useLanguage();

  const oppScore = opponent?.score ?? 0;
  const oppCombo = opponent?.combo ?? 0;
  const oppAccuracy = opponent?.accuracy ?? 100;
  const oppNoteIndex = opponent?.currentNoteIndex ?? 0;
  const oppActiveHits = opponent?.activeHits;
  const isOpponentLeading = oppScore > myScore;
  const isTied = oppScore === myScore && oppScore > 0;
  const progressPercent = totalNotes > 0 ? Math.min(100, (oppNoteIndex / totalNotes) * 100) : 0;

  return (
    <Card
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 ${
        isOpponentLeading
          ? 'border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-zinc-950 to-zinc-950 shadow-lg shadow-amber-500/10'
          : 'border-zinc-800 bg-zinc-950/70'
      }`}
    >
      {/* Disconnected Overlay */}
      {opponent?.disconnected && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-center">
          <ShieldAlert className="h-10 w-10 text-amber-400 mb-2 animate-bounce" />
          <p className="text-sm font-bold text-white">{t("Opponent disconnected")}</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            {t("Your opponent left the match. You can finish your song to record your score!")}
          </p>
        </div>
      )}

      {/* Opponent Header */}
      <CardHeader className="border-b border-zinc-800/80 p-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 font-bold text-zinc-950 text-sm shadow-md">
              {(opponent?.name || opponentName).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-white">
                  {opponent?.name || opponentName}
                </span>
                {isOpponentLeading && (
                  <Badge className="bg-amber-400 text-zinc-950 text-[10px] font-black px-1.5 py-0 flex items-center gap-0.5 shadow-sm">
                    <Crown className="h-3 w-3 fill-zinc-950" /> {t("LEADER")}
                  </Badge>
                )}
                {isTied && (
                  <Badge variant="outline" className="border-zinc-600 text-zinc-300 text-[10px] px-1.5 py-0">
                    {t("TIED")}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Activity className="h-3 w-3 text-rose-400" />
                <span>{t("Live Opponent Screen")}</span>
              </p>
            </div>
          </div>

          {/* Opponent Live Score */}
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-zinc-500 block">{t("Opponent Score")}</span>
            <span className="font-mono text-lg font-black text-amber-300">
              {oppScore.toLocaleString(locale)}
            </span>
          </div>
        </div>

        {/* Mini stats row */}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-2 text-xs font-mono">
          <div className="flex items-center gap-1 text-amber-400">
            <Flame className="h-3.5 w-3.5" />
            <span className="text-[11px] text-zinc-400">{t("Combo")}:</span>
            <strong className="text-white">{oppCombo}</strong>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <Target className="h-3.5 w-3.5" />
            <span className="text-[11px] text-zinc-400">{t("Acc")}:</span>
            <strong className="text-white">{oppAccuracy}%</strong>
          </div>
          <div className="text-zinc-400 text-[11px]">
            <span>{oppNoteIndex}/{totalNotes}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-3.5 flex flex-col justify-between flex-1 gap-3">
        {/* Opponent's Virtual Interactive Drum Rig */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
            {t("Opponent Drum Kit (Real-time)")}
          </span>

          <div className="grid grid-cols-3 gap-2">
            {(['crash', 'hihat', 'tom'] as DrumType[]).map((drum) => {
              const info = DRUM_COLORS[drum];
              const isHit = oppActiveHits?.[drum]?.isHit || opponent?.lastHit?.drum === drum;
              const rating = oppActiveHits?.[drum]?.rating || opponent?.lastHit?.rating;

              return (
                <div
                  key={drum}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all duration-150 ${
                    isHit
                      ? `${info.border} bg-zinc-800 scale-105 shadow-md ring-2 ring-white`
                      : 'border-zinc-800/80 bg-zinc-900/60 opacity-80'
                  }`}
                  style={isHit ? { boxShadow: `0 0 16px ${info.glow}` } : {}}
                >
                  <span className="text-[10px] font-bold uppercase text-zinc-300">{info.name}</span>
                  <div
                    className={`mt-1.5 h-2 w-8 rounded-full transition-all ${
                      isHit ? info.color : 'bg-zinc-700'
                    }`}
                  />
                  {isHit && rating && (
                    <span
                      className={`absolute -top-2 rounded px-1 text-[8px] font-black uppercase shadow ${
                        rating === 'perfect'
                          ? 'bg-amber-400 text-zinc-950'
                          : rating === 'good'
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {rating}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {(['snare', 'kick'] as DrumType[]).map((drum) => {
              const info = DRUM_COLORS[drum];
              const isHit = oppActiveHits?.[drum]?.isHit || opponent?.lastHit?.drum === drum;
              const rating = oppActiveHits?.[drum]?.rating || opponent?.lastHit?.rating;

              return (
                <div
                  key={drum}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all duration-150 ${
                    isHit
                      ? `${info.border} bg-zinc-800 scale-105 shadow-md ring-2 ring-white`
                      : 'border-zinc-800/80 bg-zinc-900/60 opacity-80'
                  }`}
                  style={isHit ? { boxShadow: `0 0 16px ${info.glow}` } : {}}
                >
                  <span className="text-[10px] font-bold uppercase text-zinc-300">{info.name}</span>
                  <div
                    className={`mt-1.5 h-2.5 w-12 rounded-full transition-all ${
                      isHit ? info.color : 'bg-zinc-700'
                    }`}
                  />
                  {isHit && rating && (
                    <span
                      className={`absolute -top-2 rounded px-1 text-[8px] font-black uppercase shadow ${
                        rating === 'perfect'
                          ? 'bg-amber-400 text-zinc-950'
                          : rating === 'good'
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {rating}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Hit Activity Ticker */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-2.5">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">{t("Live Hit Feed")}</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              {t("Synced")}
            </span>
          </div>

          <div className="space-y-1">
            {opponent?.recentHits && opponent.recentHits.length > 0 ? (
              opponent.recentHits.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[11px] rounded bg-zinc-900/60 px-2 py-0.5 border border-zinc-800/40 animate-fadeIn"
                >
                  <span className="font-bold text-zinc-300 uppercase">
                    {DRUM_COLORS[h.drum]?.name || h.drum}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-black uppercase px-1 rounded ${
                        h.rating === 'perfect'
                          ? 'text-amber-400'
                          : h.rating === 'good'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {h.rating}
                    </span>
                    <span className="font-mono text-zinc-400 text-[10px]">
                      +{h.points ?? 300}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-zinc-600 italic py-2 text-center">
                {t("Waiting for opponent hits...")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

