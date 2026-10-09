import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, PersonalBest, ScreenType } from '../types';
import { CHALLENGES } from '../data/challenges';
import { storageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import {
  Trophy,
  Medal,
  Flame,
  ArrowLeft,
  Sparkles,
  Calendar,
  Play,
  RotateCcw,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LeaderboardScreenProps {
  onNavigate: (screen: ScreenType) => void;
  onSelectChallengeToPlay?: (challengeId: string) => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onNavigate,
  onSelectChallengeToPlay,
}) => {
  const { user, openAuthModal } = useAuth();
  const [selectedTrack, setSelectedTrack] = useState<string>(CHALLENGES[0]?.id || 'beginner-beat');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedTrack, user]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await storageService.getLeaderboard(selectedTrack, 50);
      setEntries(data);

      if (user) {
        const pb = await storageService.getPersonalBest(user.id, selectedTrack);
        setPersonalBest(pb);
      } else {
        setPersonalBest(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 5) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US');
  };

  const getRankBadgeClass = (rank: string) => {
    switch (rank) {
      case 'S':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950 font-black shadow-[0_0_12px_rgba(251,191,36,0.5)]';
      case 'A':
        return 'bg-emerald-500 text-white font-black';
      case 'B':
        return 'bg-blue-500 text-white font-bold';
      case 'C':
        return 'bg-purple-500 text-white font-bold';
      default:
        return 'bg-zinc-700 text-zinc-300';
    }
  };

  const getMedalIcon = (rankIdx: number) => {
    if (rankIdx === 0) {
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/40">
          <Trophy className="h-4 w-4" />
        </div>
      );
    }
    if (rankIdx === 1) {
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 via-gray-300 to-slate-400 text-zinc-950 shadow-md">
          <Medal className="h-4 w-4" />
        </div>
      );
    }
    if (rankIdx === 2) {
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 text-white shadow-md">
          <Medal className="h-4 w-4" />
        </div>
      );
    }
    return (
      <span className="font-mono text-sm font-bold text-zinc-400">
        #{rankIdx + 1}
      </span>
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-zinc-950 shadow-lg shadow-amber-500/25">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl flex items-center gap-2">
                <span>Global Leaderboard</span>
                <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 text-[10px] uppercase font-bold">
                  Live
                </Badge>
              </h1>
              <p className="text-xs text-zinc-400">Honoring the top drummers and rhythm masters</p>
            </div>
          </div>
        </div>

        {/* Filter Track Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 hidden sm:inline">Track Filter:</span>
          <div className="w-48 sm:w-56">
            <Select value={selectedTrack} onValueChange={(val) => { if (val) setSelectedTrack(val); }}>
              <SelectTrigger className="border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
                <SelectValue placeholder="Select Track" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-xs text-zinc-200">
                {CHALLENGES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    🥁 {c.title} ({c.difficulty})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={loadLeaderboard}
            className="h-9 w-9 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            title="Refresh"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Personal Best Banner for currently selected track */}
      <div className="mt-4">
        <Card className="rounded-2xl border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900/60 to-rose-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                  Personal Best Record
                </span>
                <h3 className="text-base font-bold text-white">
                  {CHALLENGES.find((c) => c.id === selectedTrack)?.title || 'Challenge Track'}
                </h3>
              </div>
            </div>

            {user ? (
              personalBest ? (
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold">High Score</span>
                    <span className="font-mono text-lg font-black text-amber-400">
                      {personalBest.highScore.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold">Accuracy</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {personalBest.accuracy}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold">Max Combo</span>
                    <span className="font-mono text-sm font-bold text-rose-400">
                      {personalBest.maxCombo}x
                    </span>
                  </div>
                  <Badge className={`px-2.5 py-1 text-xs rounded-md ${getRankBadgeClass(personalBest.rank)}`}>
                    Rank {personalBest.rank}
                  </Badge>
                  {onSelectChallengeToPlay && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSelectChallengeToPlay(selectedTrack)}
                      className="rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 text-xs"
                    >
                      <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                      Beat Record
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    You haven't completed this track yet. Give it a shot!
                  </span>
                  {onSelectChallengeToPlay && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSelectChallengeToPlay(selectedTrack)}
                      className="rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 text-xs"
                    >
                      <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                      Play Now
                    </Button>
                  )}
                </div>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-amber-200">
                  Guest accounts cannot record scores on the Leaderboard. Please sign in to save your records!
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={openAuthModal}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
                >
                  Sign In / Register
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Main Leaderboard Table / Cards */}
      <div className="mt-4 flex-1">
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/60 shadow-xl backdrop-blur-md overflow-hidden">
          <CardHeader className="border-b border-zinc-800/80 p-4 pb-3 flex-row items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Top Percussionists • {CHALLENGES.find((c) => c.id === selectedTrack)?.title} ({entries.length} Players)
            </span>
            <span className="text-[11px] text-zinc-400">
              Registered players only • Highest score per account
            </span>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                Loading leaderboard rankings...
              </div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                No records recorded yet for this category. Be the first to set one!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Player</th>
                      <th className="py-3 px-4">Track</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-center">Accuracy</th>
                      <th className="py-3 px-4 text-center">Max Combo</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {entries.map((entry, idx) => {
                      const isMe = user && (user.id === entry.userId || user.username === entry.username);
                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors hover:bg-zinc-800/40 ${
                            isMe ? 'bg-rose-500/10 font-medium' : ''
                          }`}
                        >
                          {/* Rank icon / number */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center">{getMedalIcon(idx)}</div>
                          </td>

                          {/* Player info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={entry.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${entry.username}`}
                                alt={entry.username}
                                className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-950 p-0.5"
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs">{entry.username}</span>
                                  {isMe && (
                                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[9px] py-0 px-1">
                                      You
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Track Title */}
                          <td className="py-3 px-4 text-zinc-300 font-medium">
                            <span className="truncate max-w-[140px] block">{entry.trackTitle}</span>
                          </td>

                          {/* Score */}
                          <td className="py-3 px-4 text-right font-mono font-black text-amber-400 text-sm">
                            {entry.score.toLocaleString()}
                          </td>

                          {/* Accuracy */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-emerald-400">
                              {entry.accuracy.toFixed(1)}%
                            </span>
                          </td>

                          {/* Max Combo */}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-400">
                              <Flame className="h-3 w-3" />
                              {entry.maxCombo}
                            </span>
                          </td>

                          {/* Rank Grade */}
                          <td className="py-3 px-4 text-center">
                            <Badge className={`px-2 py-0.5 rounded text-[10px] ${getRankBadgeClass(entry.rank)}`}>
                              {entry.rank}
                            </Badge>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 text-right text-zinc-500 text-[11px] font-mono">
                            {formatDate(entry.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
