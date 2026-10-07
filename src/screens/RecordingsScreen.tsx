import React, { useState, useEffect, useRef } from 'react';
import { DrumKitPreset, DrumType, RecordedHit, ScreenType, UserRecording } from '../types';
import { recordingsStorage } from '../services/recordingsStorage';
import {
  renderHitsToWav,
  downloadFile,
  exportRecordingToJson,
  generateSharePayload,
} from '../services/wavExporter';
import { audioEngine } from '../services/audio';
import {
  ArrowLeft,
  Play,
  Pause,
  Download,
  Share2,
  Trash2,
  Disc3,
  Sparkles,
  Upload,
  Check,
  Copy,
  Clock,
  Music,
  Plus,
  Edit2,
  Repeat,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '../context/AuthContext';

interface RecordingsScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const RecordingsScreen: React.FC<RecordingsScreenProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [recordings, setRecordings] = useState<UserRecording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const playbackTimerRef = useRef<NodeJS.Timeout[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadRecordings();
    return () => {
      stopPlayback();
    };
  }, [user]);

  const loadRecordings = () => {
    const list = recordingsStorage.getRecordings(user?.id);
    setRecordings(list);
  };

  const stopPlayback = () => {
    playbackTimerRef.current.forEach(clearTimeout);
    playbackTimerRef.current = [];
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setPlayingId(null);
    setPlayheadMs(0);
  };

  const startPlayback = (recording: UserRecording) => {
    stopPlayback();
    setPlayingId(recording.id);
    const startWallTime = performance.now();
    const duration = Math.max(800, recording.durationMs);

    // Schedule audio playback for each hit
    recording.hits.forEach((hit) => {
      const delay = Math.max(0, hit.timestampMs);
      const timer = setTimeout(() => {
        audioEngine.playDrum(hit.drum, hit.velocity ?? 0.85, recording.preset);
      }, delay);
      playbackTimerRef.current.push(timer);
    });

    // Update playhead progress in animation frame
    const tick = () => {
      const elapsed = performance.now() - startWallTime;
      if (elapsed >= duration) {
        if (isLooping) {
          // Restart loop
          startPlayback(recording);
          return;
        } else {
          stopPlayback();
          return;
        }
      }
      setPlayheadMs(elapsed);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handleTogglePlay = (recording: UserRecording) => {
    if (playingId === recording.id) {
      stopPlayback();
    } else {
      startPlayback(recording);
    }
  };

  const handleDownloadWav = async (recording: UserRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(recording.id);
      const wavBlob = await renderHitsToWav(
        recording.hits,
        recording.durationMs,
        recording.preset
      );
      const safeTitle = recording.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadFile(wavBlob, `${safeTitle || 'drum-track'}.wav`);
    } catch (err) {
      console.error('Failed to export WAV:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadJson = (recording: UserRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    exportRecordingToJson(recording);
  };

  const handleShare = async (recording: UserRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    const { url, shareText } = generateSharePayload(recording);

    if (navigator.share) {
      try {
        await navigator.share({
          title: recording.title,
          text: shareText,
          url,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback(`Copied share link for "${recording.title}"!`);
      setTimeout(() => setShareFeedback(null), 3500);
    } catch {
      setShareFeedback('Sharing link generated!');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === id) stopPlayback();
    recordingsStorage.deleteRecording(id, user?.id);
    loadRecordings();
  };

  const handleStartRename = (recording: UserRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(recording.id);
    setEditTitle(recording.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      recordingsStorage.renameRecording(id, editTitle, user?.id);
      loadRecordings();
    }
    setEditingId(null);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAuthenticated || !user || user.id.startsWith('guest-')) {
      alert('Guest accounts cannot import tracks to the Library. Please sign in!');
      openAuthModal();
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.hits)) {
          const imported = recordingsStorage.importRecording(parsed, user.id);
          loadRecordings();
          setShareFeedback(`Imported track "${imported.title}" successfully!`);
          setTimeout(() => setShareFeedback(null), 3500);
        }
      } catch (err) {
        alert('Invalid recording file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemoTracks = () => {
    if (!user || user.id.startsWith('guest-')) return;
    const updated = recordingsStorage.loadDemoRecordingsForUser(user.id);
    setRecordings(updated);
    setShareFeedback('Loaded demo beats into your library!');
    setTimeout(() => setShareFeedback(null), 3000);
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
    return new Date(timestamp).toLocaleDateString();
  };

  const currentlyPlayingTrack = recordings.find((r) => r.id === playingId);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stopPlayback();
              onNavigate('home');
            }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-zinc-950 shadow-lg shadow-rose-500/25">
              <Disc3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Recordings Library</span>
                <Badge className="bg-rose-500/10 border-rose-500/30 text-rose-400 text-xs font-mono">
                  {recordings.length} Tracks
                </Badge>
                {isAuthenticated && user && (
                  <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-semibold">
                    {user.username}
                  </Badge>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                {isAuthenticated && user
                  ? `Personal recordings library of ${user.username}. Download WAV files or share with friends.`
                  : 'Listen to demo drum tracks. Sign in to save and manage your own recordings.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
            title="Import a drum recording JSON file"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import Track</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              stopPlayback();
              onNavigate('free-play');
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Record New Beat</span>
          </Button>
        </div>
      </div>

      {/* Share Toast Banner */}
      {shareFeedback && (
        <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
          <Check className="h-4 w-4 text-emerald-400 mr-2" />
          <AlertDescription className="text-xs font-medium">{shareFeedback}</AlertDescription>
        </Alert>
      )}

      {/* Guest Notice */}
      {(!isAuthenticated || !user) && (
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              You are browsing the Library as <strong>Guest</strong>. Guest accounts cannot save new recordings from Free Play.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openAuthModal}
            className="rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shrink-0 px-3 py-1 cursor-pointer"
          >
            Sign in to save beats
          </Button>
        </div>
      )}

      {/* Active Playback Player Bar */}
      {currentlyPlayingTrack && (
        <Card className="mb-6 rounded-2xl border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-zinc-900 to-zinc-950 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse">
                <Disc3 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                  Now Playing
                </span>
                <h3 className="text-base font-bold text-white">
                  {currentlyPlayingTrack.title}
                </h3>
              </div>
            </div>

            {/* Playhead Time & Controls */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-zinc-300">
                {(playheadMs / 1000).toFixed(1)}s / {(currentlyPlayingTrack.durationMs / 1000).toFixed(1)}s
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLooping(!isLooping)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  isLooping ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'text-zinc-400'
                }`}
                title={isLooping ? 'Looping enabled' : 'Play once'}
              >
                <Repeat className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">{isLooping ? 'Loop' : 'Once'}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={stopPlayback}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                <Pause className="h-3.5 w-3.5 mr-1" />
                Stop
              </Button>
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="mt-3 relative h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 transition-all duration-75"
              style={{
                width: `${Math.min(100, (playheadMs / currentlyPlayingTrack.durationMs) * 100)}%`,
              }}
            />
          </div>
        </Card>
      )}

      {/* Recordings Grid */}
      {recordings.length === 0 ? (
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400">
          <Disc3 className="h-12 w-12 mx-auto mb-3 text-zinc-600 animate-pulse" />
          <h3 className="text-base font-bold text-white mb-1">
            {isAuthenticated && user
              ? `Account "${user.username}" has no recordings yet`
              : 'No recordings in library'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6">
            {isAuthenticated && user
              ? 'Switch to Free Play to record your own drum beat, or load demo beats to listen!'
              : 'Switch to Free Play to start recording drum beats!'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => onNavigate('free-play')}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-5 py-2 cursor-pointer"
            >
              Start Recording in Free Play
            </Button>
            {isAuthenticated && user && (
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadDemoTracks}
                className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs px-4 py-2 cursor-pointer"
              >
                Load Demo Beats
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {recordings.map((recording) => {
            const isThisPlaying = playingId === recording.id;
            const isThisDownloading = downloadingId === recording.id;
            const isThisEditing = editingId === recording.id;

            return (
              <Card
                key={recording.id}
                className={`group relative rounded-2xl border transition-all duration-150 overflow-hidden ${
                  isThisPlaying
                    ? 'border-rose-500/60 bg-gradient-to-b from-rose-950/20 via-zinc-900 to-zinc-950 shadow-xl shadow-rose-950/20 scale-[1.01]'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
              >
                <CardHeader className="p-4 sm:p-5 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-md border-zinc-700 bg-zinc-800/80 text-[10px] font-mono uppercase text-zinc-300"
                      >
                        {recording.preset} Kit
                      </Badge>
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {(recording.durationMs / 1000).toFixed(1)}s
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        • {recording.hits.length} hits
                      </span>
                    </div>

                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatDate(recording.createdAt)}
                    </span>
                  </div>

                  {/* Title & Rename Input */}
                  {isThisEditing ? (
                    <form
                      onSubmit={(e) => handleSaveRename(recording.id, e)}
                      className="flex items-center gap-2 mt-1"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="flex-1 rounded-lg border border-zinc-750 bg-zinc-950 px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:border-rose-500"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 px-2.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="h-8 px-2 text-xs text-zinc-400"
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between group/title">
                      <h2 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                        {recording.title}
                      </h2>
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(recording, e)}
                        className="opacity-0 group-hover/title:opacity-100 text-zinc-400 hover:text-white transition-opacity p-1"
                        title="Rename recording"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-1 pb-3">
                  {/* Visual drum hit distribution pills */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2">
                    {recording.stats?.drumCounts &&
                      Object.entries(recording.stats.drumCounts)
                        .filter(([_, count]) => count > 0)
                        .map(([drum, count]) => (
                          <span
                            key={drum}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 uppercase"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  drum === 'kick'
                                    ? '#f43f5e'
                                    : drum === 'snare'
                                    ? '#10b981'
                                    : drum === 'hihat'
                                    ? '#f59e0b'
                                    : drum === 'tom'
                                    ? '#06b6d4'
                                    : '#a855f7',
                              }}
                            />
                            {drum}: {count}
                          </span>
                        ))}
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-2 border-t border-zinc-800/80 p-3 sm:p-4 bg-zinc-950/40">
                  {/* Play Button */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleTogglePlay(recording)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      isThisPlaying
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    }`}
                  >
                    {isThisPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{isThisPlaying ? 'Playing...' : 'Play'}</span>
                  </Button>

                  {/* Actions: Download WAV, Share, Delete */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* Download Studio WAV */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isThisDownloading}
                      onClick={(e) => handleDownloadWav(recording, e)}
                      className="flex items-center gap-1 rounded-lg border-zinc-750 bg-zinc-900/90 px-2 sm:px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300 transition-colors shadow"
                      title="Download as 16-bit Studio WAV audio"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {isThisDownloading ? 'Rendering...' : 'WAV'}
                      </span>
                    </Button>

                    {/* Share Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleShare(recording, e)}
                      className="flex items-center gap-1 rounded-lg border-zinc-750 bg-zinc-900/90 px-2 sm:px-2.5 py-1 text-xs font-semibold text-cyan-400 hover:bg-zinc-800 hover:text-cyan-300 transition-colors shadow"
                      title="Share track with link"
                    >
                      <Share2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>

                    {/* Download JSON */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDownloadJson(recording, e)}
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
                      title="Export JSON project file"
                    >
                      <Disc3 className="h-3.5 w-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(recording.id, e)}
                      className="h-7 w-7 text-zinc-500 hover:text-rose-400"
                      title="Delete recording"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
