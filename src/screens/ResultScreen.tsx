import React, { useEffect } from 'react';
import { GameResult, ScreenType } from '../types';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Star,
  RotateCcw,
  ListMusic,
  Home,
  Flame,
  Target,
  Award,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface ResultScreenProps {
  result: GameResult;
  onPlayAgain: () => void;
  onChooseAnother: () => void;
  onBackToHome: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  onPlayAgain,
  onChooseAnother,
  onBackToHome,
}) => {
  useEffect(() => {
    // Launch celebratory confetti if completed with good score
    if (result.accuracy >= 65) {
      try {
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4'],
        });
      } catch {
        // Fallback gracefully if canvas-confetti is unsupported
      }
    }
  }, [result.accuracy]);

  const getRankBadge = (rank: 'S' | 'A' | 'B' | 'C' | 'D') => {
    const colors = {
      S: 'from-amber-400 to-rose-500 text-zinc-950 border-amber-300 shadow-amber-500/40',
      A: 'from-emerald-400 to-cyan-500 text-zinc-950 border-emerald-300 shadow-emerald-500/40',
      B: 'from-blue-400 to-indigo-500 text-white border-blue-300 shadow-blue-500/40',
      C: 'from-zinc-400 to-zinc-600 text-white border-zinc-400 shadow-zinc-600/40',
      D: 'from-zinc-700 to-zinc-900 text-zinc-400 border-zinc-700 shadow-none',
    }[rank];

    return (
      <div
        className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br ${colors} border-2 flex items-center justify-center font-black text-3xl sm:text-4xl shadow-xl`}
      >
        {rank}
      </div>
    );
  };

  const getPerformanceFeedback = () => {
    if (result.accuracy >= 95) {
      return {
        headline: 'Virtuoso Drum Master!',
        body: 'Flawless rhythmic precision! Your timing was razor-sharp on every downbeat.',
      };
    } else if (result.accuracy >= 80) {
      return {
        headline: 'Great Performance!',
        body: 'Superb rhythm and steady tempo control. Keep practicing to hit pure S-Rank perfection.',
      };
    } else if (result.accuracy >= 60) {
      return {
        headline: 'Good Effort!',
        body: 'You locked into several great grooves. Focus on anticipating the hit conveyor line.',
      };
    } else {
      return {
        headline: 'Session Complete',
        body: 'Rhythm takes warm-up time. Try Free Play or the Beginner Beat to hone hand motions.',
      };
    }
  };

  const feedback = getPerformanceFeedback();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full animate-fade-in">
      {/* Trophy Badge */}
      <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-400 mb-4">
        <Trophy className="h-4 w-4" />
        <span>Rhythm Challenge Finished</span>
      </div>

      {/* Header */}
      <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase text-center mb-1">
        Challenge Complete
      </h1>
      <p className="text-sm text-zinc-400 font-medium mb-6">
        {result.challenge.title} • {result.challenge.bpm} BPM
      </p>

      {/* Main Score & Rank Card */}
      <div className="w-full rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-6 sm:p-8 backdrop-blur-xl shadow-2xl mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            {getRankBadge(result.rank)}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Final Score
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                {result.score.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Star Rating */}
          <div className="flex flex-col items-center sm:items-end">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Rating
            </span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((starIndex) => (
                <Star
                  key={starIndex}
                  className={`h-7 w-7 ${
                    starIndex <= result.stars
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                      : 'text-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-6">
          {/* Accuracy */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Target className="h-3 w-3 text-emerald-400" />
              Accuracy
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
              {result.accuracy}%
            </span>
          </div>

          {/* Max Combo */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-400" />
              Max Combo
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1">
              {result.maxCombo}x
            </span>
          </div>

          {/* Perfect Hits */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Perfect Hits
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
              {result.perfectHits}
            </span>
          </div>

          {/* Misses */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-rose-400" />
              Misses
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1">
              {result.misses}
            </span>
          </div>
        </div>

        {/* Evaluation Message */}
        <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 text-center">
          <h3 className="text-sm font-bold text-white mb-1">{feedback.headline}</h3>
          <p className="text-xs text-zinc-400">{feedback.body}</p>
        </div>
      </div>

      {/* Primary Actions: Play Again, Choose Another Challenge, Back to Home */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
        <button
          id="result-action-play-again"
          onClick={onPlayAgain}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all"
        >
          <RotateCcw className="h-4 w-4 stroke-[2.5]" />
          <span>Play Again</span>
        </button>

        <button
          id="result-action-choose-challenge"
          onClick={onChooseAnother}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-3.5 text-sm font-semibold text-white hover:bg-zinc-700 active:scale-95 transition-all"
        >
          <ListMusic className="h-4 w-4" />
          <span>Choose Another Challenge</span>
        </button>

        <button
          id="result-action-back-home"
          onClick={onBackToHome}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>
      </div>
    </div>
  );
};
