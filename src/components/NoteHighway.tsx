import { Card } from '@/components/ui/card';
import { useLanguage } from '@/i18n/LanguageProvider';
import { DRUMS } from '../data/drums';
import type { BeatNote, DrumType, HitRating } from '../types';

const LANE_ORDER: DrumType[] = ['snare', 'tom', 'hihat', 'kick', 'crash'];
const HIT_LINE_Y = 78;
const LOOK_AHEAD_MS = 2000;
const LOOK_BEHIND_MS = 300;

interface NoteHighwayProps {
  notes: BeatNote[];
  currentTimeMs: number;
  bpm: number;
  lastHitFeedback?: { drum: DrumType; rating: HitRating; combo: number } | null;
}

export function NoteHighway({ notes, currentTimeMs, bpm, lastHitFeedback }: NoteHighwayProps) {
  const { t } = useLanguage();
  const visibleNotes = notes.filter(note => note.timeMs >= currentTimeMs - LOOK_BEHIND_MS && note.timeMs <= currentTimeMs + LOOK_AHEAD_MS);

  return <Card className="overflow-hidden rounded-2xl border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-xl sm:p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t('Note highway')}</span><span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">{bpm} BPM</span></div>
      {lastHitFeedback && <span className={'rounded-full px-2.5 py-1 text-xs font-black uppercase ' + (lastHitFeedback.rating === 'perfect' ? 'bg-amber-300 text-zinc-950' : lastHitFeedback.rating === 'good' ? 'bg-emerald-300 text-zinc-950' : 'bg-rose-500 text-white')}>{t(lastHitFeedback.rating[0].toUpperCase() + lastHitFeedback.rating.slice(1))}{lastHitFeedback.combo > 1 ? ` · x${lastHitFeedback.combo}` : ''}</span>}
    </div>

    <div className="relative h-[280px] overflow-hidden rounded-xl border border-zinc-800 bg-[#090b12] sm:h-[340px]">
      <div className="absolute inset-0 grid grid-cols-5">
        {LANE_ORDER.map((id, index) => {
          const drum = DRUMS.find(item => item.id === id)!;
          return <div key={id} className={'relative border-r border-zinc-800/80 last:border-r-0 ' + (index % 2 === 0 ? 'bg-white/[0.015]' : 'bg-white/[0.035]')}>
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to bottom, transparent 24.7%, rgba(255,255,255,.045) 25%, transparent 25.3%, transparent 49.7%, rgba(255,255,255,.045) 50%, transparent 50.3%, transparent 74.7%, rgba(255,255,255,.045) 75%, transparent 75.3%)' }} />
            {visibleNotes.filter(note => note.drum === id).map(note => {
              const y = HIT_LINE_Y - ((note.timeMs - currentTimeMs) / LOOK_AHEAD_MS) * HIT_LINE_Y;
              return <div key={note.id} className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[top] duration-75" style={{ top: `${y}%` }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white/90 text-[10px] font-black text-zinc-950 shadow-lg sm:h-11 sm:w-11 sm:text-xs" style={{ backgroundColor: note.hit ? '#52525b' : drum.color, boxShadow: note.hit ? 'none' : `0 0 18px ${drum.glowColor}`, opacity: note.hit ? 0.42 : 1 }}>{drum.key}</div>
              </div>;
            })}
            <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 sm:bottom-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-black sm:h-10 sm:w-10 sm:text-xs" style={{ borderColor: drum.color, color: drum.color, boxShadow: `0 0 12px ${drum.glowColor}` }}>{drum.key}</span>
              <span className="text-center text-[9px] font-bold leading-tight text-zinc-300 sm:text-[10px]">{t(drum.name)}</span>
            </div>
          </div>;
        })}
      </div>
      <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: `${HIT_LINE_Y}%` }}>
        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_14px_rgba(252,211,77,0.9)]" />
        <span className="absolute right-2 -top-4 rounded bg-amber-300 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-zinc-950">{t('HIT')}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-zinc-950/90 to-transparent" />
    </div>
    <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-zinc-500"><span>{t('Notes fall toward the hit line; press the matching drum key when they arrive.')}</span><span>S · T · H · K · C</span></div>
  </Card>;
}
