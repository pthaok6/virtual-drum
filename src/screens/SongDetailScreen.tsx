import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Headphones, Drum } from 'lucide-react';
import { useChallenges } from '../data/ChallengeLibrary';
import { useLanguage } from '../i18n/LanguageProvider';
import { chooseSongDifficulty, formatSongTime } from '../services/songExperience';
import { musicSource } from '../services/songLibrary';
import { audioEngine } from '../services/audio';
import { SongCover, SongStructure } from '../components/SongPresentation';
import { BeatTimeline } from '../components/BeatTimeline';
import { Missing } from './CommunityScreens';
import type { RhythmChallenge, ScreenType } from '../types';

const levels = [{ level: 'Easy' as const, description: 'Follow the main kick and snare pulse.' }, { level: 'Medium' as const, description: 'Add hi-hats and more rhythmic detail.' }, { level: 'Hard' as const, description: 'Play fills and accents through the build-up.' }];
export function SongDetailScreen({ onSelectChallenge, onNavigate }: { onSelectChallenge: (challenge: RhythmChallenge) => void; onNavigate: (screen: ScreenType) => void }) {
  const { songId } = useParams();
  const challenges = useChallenges();
  const song = challenges.find(challenge => challenge.id === songId && challenge.music);
  const { t } = useLanguage();
  const [difficulty, setDifficulty] = useState<RhythmChallenge['difficulty']>(song?.difficulty ?? 'Easy');
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const selected = useMemo(() => song ? chooseSongDifficulty(song, difficulty) : null, [song, difficulty]);
  useEffect(() => { setDifficulty(song?.difficulty ?? 'Easy'); setTimeMs(0); setPlaying(false); setError(''); }, [songId, song?.difficulty]);
  useEffect(() => { const audio = audioRef.current; return () => { audio?.pause(); }; }, [songId, song?.music?.src]);
  if (!song || !selected) return <Missing />;
  const preview = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    audio.volume = audioEngine.getVolume() * 0.65;
    try { await audio.play(); setError(''); } catch { setError('Could not play the song. Try starting it again.'); }
  };
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <Link to="/challenges" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" />{t('Song library')}</Link>
    <audio key={song.id} ref={audioRef} src={musicSource(song.music!.src, import.meta.env?.BASE_URL ?? '/')} preload="metadata" onTimeUpdate={event => setTimeMs(event.currentTarget.currentTime * 1000)} onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError('Could not play the song. Try starting it again.')} />
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.6fr]"><aside><SongCover challenge={song} className="aspect-square max-h-80" /><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{t(song.song?.genre ?? 'Song')}</span><span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{formatSongTime(song.durationSeconds)}</span><span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{song.bpm} BPM</span></div>{song.song?.credit && <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">{t('Recording credit')}: <a href={song.song.credit.url} target="_blank" rel="noreferrer" className="underline">{song.song.credit.name}</a> · <a href={song.song.credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">{song.song.credit.license}</a></p>}</aside>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-400">{t('Feel the song')}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{song.title}</h1><p className="mt-3 text-sm text-zinc-400">{t(song.artist)}</p><p className="mt-4 text-sm leading-relaxed text-zinc-400">{t(song.description)}</p>
        {song.song?.chartSource === 'demo' && <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">{t('Demo chart: BPM, sections, and drum notes are illustrative. Automatic music analysis is not connected.')}</p>}
        <h2 className="mb-3 mt-7 text-sm font-bold text-white">{t('Choose your difficulty')}</h2><div className="grid gap-3 sm:grid-cols-3">{levels.map(item => <button key={item.level} onClick={() => setDifficulty(item.level)} aria-pressed={difficulty === item.level} className={'rounded-xl border p-4 text-left ' + (difficulty === item.level ? 'border-rose-500 bg-rose-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600')}><span className={'text-sm font-bold ' + (difficulty === item.level ? 'text-rose-300' : 'text-zinc-200')}>{t(item.level)}</span><p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{t(item.description)}</p><p className="mt-3 font-mono text-xs text-zinc-400">{(song.song?.charts[item.level] ?? song.notes).length} {t('timed hits')}</p></button>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => { audioRef.current?.pause(); onSelectChallenge(selected); onNavigate('rhythm-game'); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-bold text-zinc-950"><Drum className="h-4 w-4" />{t('Start challenge')}</button><button onClick={preview} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-200">{playing ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}{t(playing ? 'Pause' : 'Listen and preview')}</button></div>{error && <p role="alert" className="mt-3 text-xs text-rose-300">{t(error)}</p>}
      </div>
    </div>
    <section className="mt-8 space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-white">{t('Chart preview')}</h2><span className="text-xs text-zinc-500">{formatSongTime(timeMs / 1000)} / {formatSongTime(song.durationSeconds)}</span></div><BeatTimeline notes={selected.notes} currentTimeMs={timeMs} bpm={song.bpm} />{song.song && <SongStructure sections={song.song.sections} currentMs={timeMs} onSeek={seconds => { if (audioRef.current) { audioRef.current.currentTime = seconds; setTimeMs(seconds * 1000); } }} />}<p className="text-xs text-zinc-500">{t('Listen to the song and click a section to explore its drum chart.')}</p></section>
  </div>;
}
