import React, { useState, useRef } from 'react';
import { RhythmChallenge, ScreenType } from '../types';
import { CHALLENGES } from '../data/challenges';
import { audioEngine } from '../services/audio';
import { ArrowLeft, Play, Square, Award, Music, Flame, Sparkles } from 'lucide-react';

interface ChallengeSelectScreenProps {
  onNavigate: (screen: ScreenType) => void;
  onSelectChallenge: (challenge: RhythmChallenge) => void;
}

export const ChallengeSelectScreen: React.FC<ChallengeSelectScreenProps> = ({
  onNavigate,
  onSelectChallenge,
}) => {
  const [selectedId, setSelectedId] = useState<string>(CHALLENGES[0].id);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout[]>([]);

  const stopPreview = () => {
    previewTimerRef.current.forEach(clearTimeout);
    previewTimerRef.current = [];
    setPreviewingId(null);
  };

  const handleTogglePreview = (challenge: RhythmChallenge, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === challenge.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewingId(challenge.id);

    // Play first 12 notes of the rhythm challenge as an acoustic preview
    const sampleNotes = challenge.notes.slice(0, 10);
    const startOffset = sampleNotes[0]?.timeMs || 0;

    sampleNotes.forEach((note) => {
      const delay = Math.max(0, note.timeMs - startOffset);
      const timer = setTimeout(() => {
        audioEngine.playDrum(note.drum);
      }, delay);
      previewTimerRef.current.push(timer);
    });

    // Auto-stop preview after the sample finishes
    const totalSampleDuration = (sampleNotes[sampleNotes.length - 1]?.timeMs - startOffset || 2000) + 400;
    const endTimer = setTimeout(() => {
      setPreviewingId(null);
    }, totalSampleDuration);
    previewTimerRef.current.push(endTimer);
  };

  const selectedChallenge = CHALLENGES.find((c) => c.id === selectedId) || CHALLENGES[0];

  const handleStartGame = (challenge: RhythmChallenge) => {
    stopPreview();
    onSelectChallenge(challenge);
    onNavigate('rhythm-game');
  };

  const getDifficultyBadge = (difficulty: 'Easy' | 'Medium' | 'Hard') => {
    switch (difficulty) {
      case 'Easy':
        return (
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            Easy
          </span>
        );
      case 'Medium':
        return (
          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            Medium
          </span>
        );
      case 'Hard':
        return (
          <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            Hard
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      {/* Header with Back button */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
        <button
          onClick={() => {
            stopPreview();
            onNavigate('home');
          }}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Rhythm Challenge Selection
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Select a rhythm track to test your reaction speed, timing accuracy, and hand coordination.
          </p>
        </div>
      </div>

      {/* Challenge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        {CHALLENGES.map((challenge) => {
          const isSelected = selectedId === challenge.id;
          const isPreviewing = previewingId === challenge.id;

          return (
            <div
              key={challenge.id}
              onClick={() => setSelectedId(challenge.id)}
              className={`group relative rounded-2xl border p-5 sm:p-6 transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-zinc-900 to-zinc-950 shadow-xl shadow-amber-950/20 scale-[1.01]'
                  : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              {/* Selected indicator check */}
              {isSelected && (
                <div className="absolute top-4 right-4 flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Sparkles className="h-3 w-3" />
                  <span>Selected</span>
                </div>
              )}

              <div>
                {/* Header row: Difficulty & BPM */}
                <div className="flex items-center gap-2 mb-3">
                  {getDifficultyBadge(challenge.difficulty)}
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
                    {challenge.bpm} BPM
                  </span>
                  <span className="text-xs text-zinc-400">
                    {challenge.notes.length} guided hits
                  </span>
                </div>

                {/* Song Title & Artist */}
                <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  {challenge.title}
                </h2>
                <p className="text-xs text-zinc-400 font-medium mb-3">
                  {challenge.artist}
                </p>

                {/* Description */}
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-4">
                  {challenge.description}
                </p>
              </div>

              {/* Action row: Audio sample preview & Select button */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(e) => handleTogglePreview(challenge, e)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    isPreviewing
                      ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse'
                      : 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {isPreviewing ? <Square className="h-3.5 w-3.5 fill-current" /> : <Music className="h-3.5 w-3.5" />}
                  <span>{isPreviewing ? 'Stop Sample' : 'Sample Beat'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartGame(challenge)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Play Challenge</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Play Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Ready to perform
          </span>
          <h2 className="text-base font-bold text-white">
            Ready to play: <span className="text-amber-300">{selectedChallenge.title}</span> ({selectedChallenge.bpm} BPM)
          </h2>
        </div>

        <button
          id="challenge-start-btn"
          onClick={() => handleStartGame(selectedChallenge)}
          className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Launch Rhythm Challenge</span>
        </button>
      </div>
    </div>
  );
};
