import React from 'react';
import type { DrumType, HitRating } from '../types';
import type { OpponentState } from '../hooks/useMultiplayerGame';
import { useLanguage } from '../i18n/LanguageProvider';
import { Swords, Users, Crown, Zap, Flame, Award, Volume2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MultiplayerHUDProps {
  mode: 'versus' | 'together';
  roomName: string;
  myScore: number;
  myCombo: number;
  opponent: OpponentState | null;
  opponentName?: string;
  // Together mode props:
  currentNoteIndex?: number;
  isMyTurn?: boolean;
  activePlayerName?: string;
  notesRemainingInTurn?: number;
  teamScore?: number;
  teamCombo?: number;
  lastRemoteHit?: { drum: DrumType; rating: HitRating } | null;
}

const DRUM_NAMES: Record<DrumType, string> = {
  hihat: 'Hi-Hat',
  tom: 'Tom',
  crash: 'Crash',
  snare: 'Snare',
  kick: 'Kick',
};

export const MultiplayerHUD: React.FC<MultiplayerHUDProps> = ({
  mode,
  roomName,
  myScore,
  myCombo,
  opponent,
  opponentName = 'Opponent',
  currentNoteIndex = 0,
  isMyTurn = true,
  activePlayerName,
  notesRemainingInTurn = 10,
  teamScore = 0,
  teamCombo = 0,
  lastRemoteHit,
}) => {
  const { t, locale } = useLanguage();

  if (mode === 'versus') {
    const oppScore = opponent?.score ?? 0;
    const oppCombo = opponent?.combo ?? 0;
    const oppAccuracy = opponent?.accuracy ?? 100;
    const scoreDiff = myScore - oppScore;
    const oppActiveHits = opponent?.activeHits;

    return (
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl backdrop-blur-md">
        {/* Versus Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
              <Swords className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                {t("Challenge match")} · {roomName}
              </p>
              <p className="text-[11px] text-zinc-400">
                {scoreDiff > 0 ? (
                  <span className="font-semibold text-emerald-400">
                    {t("You lead by +{diff} pts", { diff: scoreDiff.toLocaleString(locale) })}
                  </span>
                ) : scoreDiff < 0 ? (
                  <span className="font-semibold text-amber-400">
                    {t("Opponent leads by +{diff} pts", { diff: Math.abs(scoreDiff).toLocaleString(locale) })}
                  </span>
                ) : (
                  <span className="text-zinc-400">{t("Scores are tied!")}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase">{t("Your Score")}</span>
              <span className="font-bold text-white text-base">{myScore.toLocaleString(locale)}</span>
            </div>
            <span className="text-zinc-600 font-sans font-bold">VS</span>
            <div className="text-left">
              <span className="text-[10px] text-zinc-500 block uppercase">{opponent?.name || opponentName}</span>
              <span className="font-bold text-amber-300 text-base">{oppScore.toLocaleString(locale)}</span>
            </div>
          </div>
        </div>

        {/* Opponent Live Status & Mini Visualizer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 font-bold text-zinc-950 text-sm">
              {(opponent?.name || opponentName).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{opponent?.name || opponentName}</span>
                {opponent?.finished && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
                    {t("Finished")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span>Combo: <strong className="text-amber-300 font-mono">{oppCombo}</strong></span>
                <span>Acc: <strong className="text-emerald-400 font-mono">{oppAccuracy}%</strong></span>
                {opponent?.lastHit && (
                  <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                    opponent.lastHit.rating === 'perfect'
                      ? 'bg-amber-500/20 text-amber-300'
                      : opponent.lastHit.rating === 'good'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {opponent.lastHit.rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Opponent Realtime Mini Drum Pads Visualizer */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
            <span className="text-[10px] text-zinc-500 uppercase mr-1">{t("Opponent Live:")}</span>
            {(['hihat', 'tom', 'crash', 'snare', 'kick'] as DrumType[]).map((drum) => {
              const isHit = oppActiveHits?.[drum]?.isHit || opponent?.lastHit?.drum === drum;
              return (
                <div
                  key={drum}
                  className={`h-5 px-1.5 rounded flex items-center justify-center text-[9px] font-bold uppercase transition-all duration-150 ${
                    isHit
                      ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/40 ring-1 ring-white'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                  title={`${DRUM_NAMES[drum]} (${isHit ? 'Hit!' : 'Idle'})`}
                >
                  {drum === 'hihat' ? 'HH' : drum.slice(0, 2).toUpperCase()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Together / Co-op Turn-based Mode
  const notesHitInTurn = 10 - notesRemainingInTurn;

  return (
    <div className={`mb-4 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 ${
      isMyTurn
        ? 'border-rose-500/50 bg-gradient-to-r from-rose-500/15 via-zinc-950 to-amber-500/10 shadow-rose-500/10'
        : 'border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 via-zinc-950 to-violet-500/10'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            isMyTurn ? 'bg-rose-500 text-zinc-950 animate-bounce' : 'bg-cyan-500/20 text-cyan-400'
          }`}>
            <Users className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                {t("Play one song together")} · {roomName}
              </span>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300">
                {t("Turn-based 10 notes")}
              </Badge>
            </div>
            <p className="text-xs font-bold text-white mt-0.5">
              {isMyTurn ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 animate-pulse" />
                  {t("YOUR TURN NOW! Strike the drums ({remaining} notes left)", { remaining: notesRemainingInTurn })}
                </span>
              ) : (
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                  {t("{name}'s turn ({hit}/10 notes) · Listen to their beats!", {
                    name: activePlayerName || opponentName,
                    hit: notesHitInTurn,
                  })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Shared Team Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-center">
            <span className="text-[10px] text-zinc-500 block uppercase">{t("Team Score")}</span>
            <span className="font-bold text-amber-300 text-sm">{teamScore.toLocaleString(locale)}</span>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-center">
            <span className="text-[10px] text-zinc-500 block uppercase">{t("Team Combo")}</span>
            <span className="font-bold text-emerald-400 text-sm flex items-center gap-1 justify-center">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              {teamCombo}
            </span>
          </div>
        </div>
      </div>

      {/* Turn Progress Indicators (10 note dots) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-400 mr-1.5 uppercase font-semibold">
            {t("Turn Progress:")}
          </span>
          {Array.from({ length: 10 }).map((_, i) => {
            const isCompleted = i < notesHitInTurn;
            const isCurrent = i === notesHitInTurn;
            return (
              <div
                key={i}
                className={`h-2.5 w-4 rounded-full transition-all duration-200 ${
                  isCompleted
                    ? (isMyTurn ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : 'bg-cyan-400 shadow-sm shadow-cyan-400/50')
                    : isCurrent
                    ? 'bg-amber-400 ring-2 ring-white animate-pulse'
                    : 'bg-zinc-800'
                }`}
              />
            );
          })}
        </div>

        {/* Warning badge if not my turn */}
        {!isMyTurn ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-300/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>{t("Input locked. Partner is playing now.")}</span>
          </div>
        ) : (
          <div className="text-xs text-emerald-300 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            {t("Your hands are active! Go!")}
          </div>
        )}
      </div>

      {/* Realtime Partner Drum Feedback in Together Mode */}
      {!isMyTurn && lastRemoteHit && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs text-cyan-200 animate-fadeIn">
          <Volume2 className="h-4 w-4 text-cyan-400" />
          <span>
            {activePlayerName || opponentName} {t("hit")} <strong>{DRUM_NAMES[lastRemoteHit.drum]}</strong>
          </span>
          <span className="uppercase text-[10px] font-bold bg-cyan-400/20 px-1.5 py-0.5 rounded text-cyan-300">
            {lastRemoteHit.rating}
          </span>
        </div>
      )}
    </div>
  );
};

