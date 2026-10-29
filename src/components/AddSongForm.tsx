import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileAudio, LoaderCircle, Music, Plus } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { buildCustomChallenge, readAudioDuration, type SavedSong } from '../services/songLibrary';
import { analyzeSongFile, MAX_ANALYSIS_SECONDS, trimAudioFile, type SongAnalysis } from '../services/songAnalysis';
import { chooseSongDifficulty, formatSongTime } from '../services/songExperience';
import { createId } from '../services/id';
import type { RhythmChallenge } from '../types';
import { SongStructure } from './SongPresentation';
import { EditableNoteTimeline } from './EditableNoteTimeline';

type Stage = 'idle' | 'metadata' | 'rhythm' | 'ready' | 'saving';

export function AddSongForm({ onAddSong }: { onAddSong: (song: SavedSong) => Promise<RhythmChallenge> }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<RhythmChallenge['difficulty']>('Easy');
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [duration, setDuration] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [previewTime, setPreviewTime] = useState(0);
  const run = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPreviewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl); }, [audioPreviewUrl]);
  useEffect(() => () => { run.current++; controller.current?.abort(); }, []);
  const busy = !['idle', 'ready'].includes(stage);
  const preview = useMemo(() => {
    if (!analysis || !title.trim()) return null;
    return chooseSongDifficulty(buildCustomChallenge({
      id: 'upload-preview', title, bpm: analysis.bpm, durationSeconds: analysis.durationSeconds,
      startSeconds: analysis.beatTimes[0] ?? 0, difficulty: 'Medium', beatTimes: analysis.beatTimes,
      analysisNotes: analysis.notes,
    }, ''), difficulty);
  }, [analysis, title, difficulty]);
  const reset = () => {
    run.current++; controller.current?.abort(); controller.current = null;
    setStage('idle'); setDuration(0); setAnalysis(null); setPreviewTime(0); setError('');
  };
  const editNotes = (notes: SongAnalysis['notes']) => setAnalysis(previous => previous ? { ...previous, notes } : previous);
  const analyze = async () => {
    if (!file || !title.trim() || busy) return;
    const token = ++run.current;
    setError(''); setAnalysis(null); setStage('metadata');
    try {
      const originalDuration = await readAudioDuration(file);
      if (token !== run.current) return;
      const trimmedFile = originalDuration > MAX_ANALYSIS_SECONDS ? await trimAudioFile(file, MAX_ANALYSIS_SECONDS) : file;
      if (token !== run.current) return;
      setFile(trimmedFile);
      setStage('rhythm'); controller.current = new AbortController();
      const result = await analyzeSongFile(trimmedFile, controller.current.signal);
      if (token !== run.current) return;
      controller.current = null;
      setFile(new File([result.backingTrack], `${title.trim()} (no drums).wav`, { type: 'audio/wav' }));
      setAnalysis(result); setDuration(Math.min(originalDuration, MAX_ANALYSIS_SECONDS)); setStage('ready');
    } catch (cause) {
      if (token === run.current) {
        controller.current = null;
        setError(cause instanceof Error ? cause.message : 'Could not analyze this audio file. Try another file.');
        setStage('idle');
      }
    }
  };
  const save = async () => {
    if (!file || !analysis || !preview || busy) return;
    const token = ++run.current;
    setStage('saving'); setError('');
    try {
      await onAddSong({
        id: 'custom-' + createId(), title: title.trim(), bpm: analysis.bpm,
        startSeconds: analysis.beatTimes[0] ?? 0, difficulty, durationSeconds: duration,
        file, beatTimes: analysis.beatTimes, analysisNotes: analysis.notes,
      });
      if (token !== run.current) return;
      setOpen(false); setFile(null); setTitle(''); reset();
    } catch (cause) {
      if (token === run.current) { setError(cause instanceof Error ? cause.message : 'Could not save this song.'); setStage('ready'); }
    }
  };

  return <section className="mb-8 rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-500/10 to-violet-500/5 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-white"><Music className="h-5 w-5 text-rose-400" />{t('Turn your music into a drum challenge')}</h2><p className="mt-1 text-sm text-zinc-400">{t('Choose a song, preview its arrangement, and play along.')}</p></div><button type="button" disabled={stage === 'saving'} onClick={() => { if (open) reset(); setOpen(!open); }} aria-expanded={open} aria-controls="add-song-form" className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600"><Plus className="h-4 w-4" />{t(open ? 'Close' : 'Add song')}</button></div>
    {open && <div id="add-song-form" className="mt-5 space-y-5">
      <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-200">{t('Audio is sent to the analysis backend to separate drums and create a beat chart. The backing track is saved in this browser.')} {t('Only the first 20 seconds are analyzed and saved.')}</p>
      <ol className="grid grid-cols-3 gap-2 text-xs font-semibold">{['Choose audio', 'Analyze rhythm', 'Preview chart'].map((label, index) => <li key={label} className={'rounded-lg border p-2 ' + (index === 0 && stage === 'idle' || index === 1 && ['metadata', 'rhythm'].includes(stage) || index === 2 && ['ready', 'saving'].includes(stage) ? 'border-rose-500/40 text-rose-300' : 'border-zinc-800 text-zinc-500')}>{index + 1}. {t(label)}</li>)}</ol>
      {stage === 'idle' && <form onSubmit={event => { event.preventDefault(); void analyze(); }} className="space-y-4"><label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-950/50 p-6 text-center hover:border-rose-400"><FileAudio className="h-8 w-8 text-rose-400" /><span className="text-sm font-bold text-white">{file ? file.name : t('Choose an audio file')}</span><span className="text-xs text-zinc-500">MP3 · WAV · OGG · M4A</span><input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" required={!file} aria-label={t('Audio file')} onChange={event => { reset(); const selected = event.target.files?.[0] ?? null; setFile(selected); setTitle(selected?.name.replace(/\.[^.]+$/, '').slice(0, 80) ?? ''); }} className="w-full max-w-xs text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" /></label><label className="block text-xs font-semibold text-zinc-300">{t('Song title')}<input required maxLength={80} value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-rose-400" /></label><button disabled={!file || !title.trim()} className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{t('Analyze song')}</button></form>}
      {['metadata', 'rhythm'].includes(stage) && <div className="space-y-3 rounded-xl bg-zinc-950/60 p-5" role="status">{[{ id: 'metadata', label: 'Reading audio duration' }, { id: 'rhythm', label: 'Separating drums and creating chart' }].map((step, index) => <p key={step.id} className="flex items-center gap-3 text-sm text-zinc-400">{['metadata', 'rhythm'].indexOf(stage) > index ? <Check className="h-4 w-4 text-emerald-400" /> : stage === step.id ? <LoaderCircle className="h-4 w-4 animate-spin text-rose-400" /> : <span className="h-4 w-4 rounded-full border border-zinc-700" />}{t(step.label)}</p>)}</div>}
      {['ready', 'saving'].includes(stage) && preview && analysis && <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-white">{title}</h3><p className="text-xs text-zinc-400">{formatSongTime(duration)} · {analysis.bpm} BPM · {preview.notes.length} {t('timed hits')}</p></div><span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">{t('Estimated beat chart')}</span></div>{audioPreviewUrl && <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="mb-2 text-xs font-semibold text-zinc-300">{t('Song preview')}</p><audio ref={audioRef} key={audioPreviewUrl} controls preload="metadata" src={audioPreviewUrl} className="w-full" onTimeUpdate={event => setPreviewTime(event.currentTarget.currentTime)} onSeeked={event => setPreviewTime(event.currentTarget.currentTime)} /></div>}<div className="flex flex-wrap gap-2">{(['Easy', 'Medium', 'Hard'] as const).map(level => <button key={level} type="button" onClick={() => setDifficulty(level)} aria-pressed={difficulty === level} className={'rounded-xl border px-4 py-2 text-sm font-bold ' + (difficulty === level ? 'border-rose-500 bg-rose-500/15 text-rose-300' : 'border-zinc-700 text-zinc-400')}>{t(level)}</button>)}</div><SongStructure sections={preview.song!.sections} /><EditableNoteTimeline notes={analysis.notes} durationSeconds={analysis.analyzedDurationSeconds} currentTime={previewTime} onSeek={time => { if (audioRef.current) { audioRef.current.currentTime = time; audioRef.current.pause(); setPreviewTime(time); } }} onChange={editNotes} /><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{t(stage === 'saving' ? 'Adding song...' : 'Save and view song')}</button><button type="button" disabled={busy} onClick={() => { reset(); setFile(null); setTitle(''); }} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300">{t('Choose another file')}</button></div></div>}
      {error && <p role="alert" className="text-sm text-rose-300">{t(error)}</p>}
      <p className="text-xs text-zinc-500">{t('Songs are saved in this browser when storage is available. The separated backing track is saved in IndexedDB.')}</p>
    </div>}
  </section>;
}
