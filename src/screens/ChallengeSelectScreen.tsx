import React, { useState, useRef } from 'react';
import { RhythmChallenge, ScreenType } from '../types';
import { CHALLENGES } from '../data/challenges';
import { audioEngine } from '../services/audio';
import { ArrowLeft, Play, Square, Award, Music, Flame, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

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
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard' | 'Expert'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleStartGame = (challenge: RhythmChallenge) => {
    stopPreview();
    onSelectChallenge(challenge);
    onNavigate('rhythm-game');
  };

  const getDifficultyBadge = (difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert') => {
    switch (difficulty) {
      case 'Easy':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-400">
            Easy
          </Badge>
        );
      case 'Medium':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 px-2.5 text-xs font-semibold text-amber-400">
            Medium
          </Badge>
        );
      case 'Hard':
        return (
          <Badge variant="outline" className="border-rose-500/30 bg-rose-500/15 px-2.5 text-xs font-semibold text-rose-400">
            Hard
          </Badge>
        );
      case 'Expert':
        return (
          <Badge variant="outline" className="border-purple-500/40 bg-purple-500/20 px-2.5 text-xs font-bold text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
            ⚡ Expert
          </Badge>
        );
    }
  };

  const filteredChallenges = CHALLENGES.filter((c) => {
    const matchesDifficulty = difficultyFilter === 'All' || c.difficulty === difficultyFilter;
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDifficulty && matchesSearch;
  });

  const selectedChallenge = CHALLENGES.find((c) => c.id === selectedId) || filteredChallenges[0] || CHALLENGES[0];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      {/* Header with Back button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stopPreview();
              onNavigate('home');
            }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Rhythm Challenge Tracks</span>
              <Badge className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-xs font-mono">
                {CHALLENGES.length} Tracks
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Select a track from Easy to Expert to test your timing, speed, and rhythm precision.
            </p>
          </div>
        </div>

        {/* Difficulty Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {(['All', 'Easy', 'Medium', 'Hard', 'Expert'] as const).map((diff) => {
            const count = diff === 'All' ? CHALLENGES.length : CHALLENGES.filter((c) => c.difficulty === diff).length;
            const isActive = difficultyFilter === diff;
            return (
              <button
                key={diff}
                type="button"
                onClick={() => setDifficultyFilter(diff)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? diff === 'Expert'
                      ? 'bg-purple-600 text-white shadow-md'
                      : diff === 'Hard'
                      ? 'bg-rose-500 text-white shadow-md'
                      : diff === 'Medium'
                      ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                      : diff === 'Easy'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold'
                      : 'bg-zinc-800 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {diff} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Challenge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        {filteredChallenges.map((challenge) => {
          const isSelected = selectedId === challenge.id;
          const isPreviewing = previewingId === challenge.id;

          return (
            <Card
              key={challenge.id}
              onClick={() => setSelectedId(challenge.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(challenge.id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`group relative cursor-pointer gap-0 rounded-2xl border py-0 text-zinc-100 transition-all duration-150 ${
                isSelected
                  ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-zinc-900 to-zinc-950 shadow-xl shadow-amber-950/20 scale-[1.01]'
                  : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              {/* Selected indicator check */}
              {isSelected && (
                <Badge variant="outline" className="absolute right-4 top-4 border-amber-500/20 bg-amber-500/10 text-[11px] font-bold text-amber-400">
                  <Sparkles className="h-3 w-3" />
                  <span>Selected</span>
                </Badge>
              )}

              <CardContent className="p-5 pb-4 sm:p-6 sm:pb-4">
                {/* Header row: Difficulty & BPM */}
                <div className="flex items-center gap-2 mb-3">
                  {getDifficultyBadge(challenge.difficulty)}
                  <Badge variant="secondary" className="rounded bg-zinc-800 px-2 font-mono text-xs text-zinc-300">
                    {challenge.bpm} BPM
                  </Badge>
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
              </CardContent>

              {/* Action row: Audio sample preview & Select button */}
              <CardFooter className="flex items-center justify-between gap-3 border-t border-zinc-800/80 bg-transparent p-5 pt-4 sm:p-6 sm:pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleTogglePreview(challenge, e)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    isPreviewing
                      ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse'
                      : 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {isPreviewing ? <Square className="h-3.5 w-3.5 fill-current" /> : <Music className="h-3.5 w-3.5" />}
                  <span>{isPreviewing ? 'Stop Sample' : 'Sample Beat'}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartGame(challenge)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Play Challenge</span>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Primary Play Banner */}
      <Card className="gap-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 py-0 text-zinc-100 backdrop-blur-md">
        <CardContent className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Ready to perform
          </span>
          <h2 className="text-base font-bold text-white">
            Ready to play: <span className="text-amber-300">{selectedChallenge.title}</span> ({selectedChallenge.bpm} BPM)
          </h2>
        </div>

        <Button
          id="challenge-start-btn"
          size="lg"
          onClick={() => handleStartGame(selectedChallenge)}
          className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Launch Rhythm Challenge</span>
        </Button>
        </CardContent>
      </Card>
    </div>
  );
};
