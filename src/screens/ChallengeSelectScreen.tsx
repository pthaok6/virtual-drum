import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Disc3, Search } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { useChallenges } from '../data/ChallengeLibrary';
import { AddSongForm } from '../components/AddSongForm';
import { SongCover } from '../components/SongPresentation';
import { formatSongTime } from '../services/songExperience';
import type { SavedSong } from '../services/songLibrary';
import type { RhythmChallenge, ScreenType } from '../types';

export function ChallengeSelectScreen({ onNavigate, onSelectChallenge, onAddSong, onViewSong, storageMessage }: {
  onNavigate: (screen: ScreenType) => void; onSelectChallenge: (challenge: RhythmChallenge) => void;
  onAddSong: (song: SavedSong) => Promise<RhythmChallenge>; onViewSong: (id: string) => void; storageMessage?: string;
}) {
  const { t } = useLanguage();
  const challenges = useChallenges();
  const [tab, setTab] = useState('songs');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All genres');
  const songs = challenges.filter(challenge => challenge.music);
  const genres = ['All genres', ...new Set(songs.map(song => song.song?.genre ?? 'Other'))];
  const filtered = challenges.filter(challenge => (tab === 'practice' ? !challenge.music : tab === 'mine' ? challenge.song?.source === 'upload' : challenge.music && challenge.song?.source !== 'upload')
    && (genre === 'All genres' || challenge.song?.genre === genre)
    && (challenge.title + ' ' + challenge.artist).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => Number(b.song?.source === 'recording') - Number(a.song?.source === 'recording'));
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <button onClick={() => onNavigate('home')} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" />{t('Back to Home')}</button>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-400">{t('Rhythm Challenge')}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t('Song library')}</h1><p className="mt-2 max-w-xl text-sm text-zinc-400">{t('Find your groove. Choose a song, pick a difficulty, and feel every beat.')}</p></div><div className="flex items-center gap-2 text-xs text-zinc-500"><Disc3 className="h-4 w-4 text-rose-400" />{songs.length} {t('songs to explore')}</div></div>
    <AddSongForm onAddSong={async song => { const challenge = await onAddSong(song); onViewSong(challenge.id); return challenge; }} />
    {storageMessage && <p role="status" className="mb-4 text-sm text-amber-300">{t(storageMessage)}</p>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1" role="tablist" aria-label={t('Song collections')}>{[{ id: 'songs', title: 'Discover' }, { id: 'mine', title: 'My songs' }, { id: 'practice', title: 'Drum practice' }].map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setGenre('All genres'); }} className={'rounded-lg px-4 py-2 text-xs font-bold ' + (tab === item.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-200')}>{t(item.title)}</button>)}</div><div className="flex w-full gap-2 sm:w-auto"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={t('Search songs')} placeholder={t('Search songs or artists')} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-rose-400" /></div>{tab !== 'practice' && <select value={genre} onChange={event => setGenre(event.target.value)} aria-label={t('Genre')} className="max-w-36 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300">{genres.map(item => <option key={item} value={item}>{t(item)}</option>)}</select>}</div></div>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(challenge => <article key={challenge.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600">
      {challenge.music && <Link to={'/songs/' + encodeURIComponent(challenge.id)} aria-label={t('View song {title}', { title: challenge.title })}><SongCover challenge={challenge} className="h-44" /></Link>}
      <div className="p-5"><div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-400">{t(challenge.song?.source === 'recording' ? 'Recording' : challenge.song?.source === 'upload' ? 'Your music' : challenge.music ? 'Original sample' : 'Guided')}</span>{challenge.song?.chartSource === 'demo' && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">{t('Demo chart')}</span>}</div><h2 className="text-lg font-bold text-white">{challenge.music ? <Link to={'/songs/' + encodeURIComponent(challenge.id)} className="hover:text-rose-300">{challenge.title}</Link> : t(challenge.title)}</h2><p className="mt-1 text-xs text-zinc-500">{t(challenge.artist)}</p><div className="mt-4 flex items-center gap-3 font-mono text-xs text-zinc-400"><span>{formatSongTime(challenge.durationSeconds)}</span><span>·</span><span>{challenge.bpm} BPM</span></div><div className="mt-5">{challenge.music ? <Link to={'/songs/' + encodeURIComponent(challenge.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500">{t('Choose difficulty')}<ArrowRight className="h-4 w-4" /></Link> : <button onClick={() => { onSelectChallenge(challenge); onNavigate('rhythm-game'); }} className="w-full rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500">{t('Play Challenge')}</button>}</div></div>
    </article>)}</div>
    {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center"><Disc3 className="mx-auto mb-3 h-8 w-8 text-zinc-600" /><h2 className="font-bold text-zinc-300">{t(tab === 'mine' && !query ? 'Your song library starts here' : 'No songs found')}</h2><p className="mt-2 text-sm text-zinc-500">{t(tab === 'mine' && !query ? 'Add an audio file above to preview your first challenge.' : 'Try another song, artist, or genre.')}</p></div>}
  </div>;
}
