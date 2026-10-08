import { Music2 } from 'lucide-react';
import type { RhythmChallenge, SongSection } from '../types';
import { useLanguage } from '../i18n/LanguageProvider';
import { formatSongTime } from '../services/songExperience';

export function SongCover({ challenge, className = '' }: { challenge: RhythmChallenge; className?: string }) {
  return <div className={'relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ' + (challenge.song?.color ?? 'from-rose-500 via-amber-700 to-zinc-950') + ' ' + className}>
    <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border-[24px] border-white/10" />
    <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full border-[24px] border-white/10" />
    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-black/20 shadow-2xl"><Music2 className="h-11 w-11 text-white/90" /></div>
    <span className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">{challenge.song?.genre ?? 'Rhythm'}</span>
  </div>;
}
export function SongStructure({ sections, currentMs, onSeek }: { sections: SongSection[]; currentMs?: number; onSeek?: (seconds: number) => void }) {
  const { t } = useLanguage();
  const total = sections.at(-1)?.endMs ?? 1;
  return <div className="space-y-3"><div className="flex h-2 gap-1 overflow-hidden rounded-full">{sections.map(section => <span key={section.id} style={{ width: (section.endMs - section.startMs) / total * 100 + '%' }} className={section.intensity === 'high' ? 'bg-rose-400' : section.intensity === 'medium' ? 'bg-amber-400' : 'bg-cyan-400'} />)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{sections.map(section => {
    const active = currentMs !== undefined && currentMs >= section.startMs && currentMs < section.endMs;
    const content = <><span className={'block text-xs font-bold ' + (active ? 'text-rose-300' : 'text-zinc-300')}>{t(section.label)}</span><span className="mt-1 block font-mono text-[10px] text-zinc-500">{formatSongTime(section.startMs / 1000)} – {formatSongTime(section.endMs / 1000)}</span></>;
    return onSeek ? <button key={section.id} type="button" onClick={() => onSeek(section.startMs / 1000)} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-left hover:border-rose-500/50">{content}</button> : <div key={section.id} className={'rounded-lg border p-2 ' + (active ? 'border-rose-500/40 bg-rose-500/10' : 'border-zinc-800 bg-zinc-950')}>{content}</div>;
  })}</div></div>;
}
