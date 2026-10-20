import { useState, type PointerEvent } from 'react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/i18n/LanguageProvider';
import { DRUMS } from '../data/drums';
import type { DrumType } from '../types';

const LANES: DrumType[] = ['snare', 'tom', 'hihat', 'kick', 'crash'];
const WIDTH = 1000;
const HEIGHT = 300;
const LEFT = 42;
const RIGHT = 18;

export interface EditableNote {
  id: string;
  time: number;
  lane: DrumType;
}

export function EditableNoteTimeline({ notes, durationSeconds, currentTime = 0, onSeek, onChange }: {
  notes: EditableNote[];
  durationSeconds: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onChange: (notes: EditableNote[]) => void;
}) {
  const { t } = useLanguage();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const span = Math.max(1, Math.min(durationSeconds, 120));
  const chartWidth = WIDTH - LEFT - RIGHT;
  const laneHeight = 42;
  const timeToX = (time: number) => LEFT + time / span * chartWidth;

  const moveNote = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaledX = (event.clientX - rect.left) / rect.width * WIDTH;
    const time = Math.round(Math.max(0, Math.min(span - 0.1, (scaledX - LEFT) / chartWidth * span)) * 100) / 100;
    onChange(notes.map(note => note.id === draggingId ? { ...note, time } : note));
  };

  return <Card className="space-y-2 rounded-xl border-zinc-800 bg-zinc-950 p-3 text-zinc-100">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-bold text-white">{t('Edit hit positions')}</p><p className="text-[10px] text-zinc-500">{t('Drag a note left or right to adjust its timing.')}</p></div>
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('Editable drum hit timeline')} className="min-w-[620px] w-full touch-none select-none rounded-lg bg-zinc-900" onClick={event => { if (!onSeek || draggingId) return; const rect = event.currentTarget.getBoundingClientRect(); const scaledX = (event.clientX - rect.left) / rect.width * WIDTH; onSeek(Math.max(0, Math.min(span, (scaledX - LEFT) / chartWidth * span))); }} onPointerMove={moveNote} onPointerUp={event => { setDraggingId(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => setDraggingId(null)}>
        {LANES.map((lane, laneIndex) => {
          const drum = DRUMS.find(item => item.id === lane)!;
          const y = 32 + laneIndex * laneHeight;
          return <g key={lane}>
            <rect x={LEFT} y={y - 16} width={chartWidth} height={laneHeight - 1} fill={laneIndex % 2 ? '#18181b' : '#1f1f23'} />
            <text x="8" y={y + 4} fill={drum.color} fontSize="12" fontWeight="700">{drum.key}</text>
            <text x="25" y={y + 4} fill="#a1a1aa" fontSize="9">{t(drum.name).slice(0, 3)}</text>
          </g>;
        })}
        {Array.from({ length: Math.floor(span / 10) + 1 }, (_, index) => {
          const time = index * 10;
          const x = timeToX(time);
          return <g key={time}><line x1={x} y1="15" x2={x} y2="252" stroke="#52525b" strokeOpacity=".45" strokeDasharray="3 5"/><text x={x + 3} y="278" fill="#71717a" fontSize="10">{Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}</text></g>;
        })}
        {notes.map(note => {
          const laneIndex = LANES.indexOf(note.lane);
          const drum = DRUMS.find(item => item.id === note.lane)!;
          const y = 32 + Math.max(0, laneIndex) * laneHeight;
          return <circle key={note.id} data-note-id={note.id} cx={timeToX(note.time)} cy={y} r={draggingId === note.id ? 10 : 7} fill={drum.color} stroke={draggingId === note.id ? '#fff' : '#18181b'} strokeWidth="2" className="cursor-grab active:cursor-grabbing" onPointerDown={event => { event.preventDefault(); setDraggingId(note.id); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); }}><title>{`${t(drum.name)} · ${note.time.toFixed(2)}s`}</title></circle>;
        })}
        <line x1={timeToX(currentTime)} y1="12" x2={timeToX(currentTime)} y2="258" stroke="#fb7185" strokeWidth="3" pointerEvents="none" />
        <line x1={LEFT} y1="258" x2={WIDTH - RIGHT} y2="258" stroke="#71717a" strokeWidth="1" />
      </svg>
    </div>
    <p className="text-right text-[10px] text-zinc-500">{t('Showing first two minutes · {count} hits', { count: notes.length })}</p>
  </Card>;
}
