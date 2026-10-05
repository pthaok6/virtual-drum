import { DrumInfo } from '../types';

export const DRUMS: DrumInfo[] = [
  {
    id: 'hihat',
    name: 'Hi-Hat',
    subtitle: 'Crisp Cymbal',
    key: 'H',
    color: '#f59e0b', // Amber
    glowColor: 'rgba(245, 158, 11, 0.45)',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    visualZone: {
      x: 5,
      y: 58,
      width: 24,
      height: 28,
    },
  },
  {
    id: 'tom',
    name: 'Tom',
    subtitle: 'High Resonant',
    key: 'T',
    color: '#06b6d4', // Cyan
    glowColor: 'rgba(6, 182, 212, 0.45)',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/40',
    visualZone: {
      x: 38,
      y: 54,
      width: 24,
      height: 28,
    },
  },
  {
    id: 'crash',
    name: 'Crash',
    subtitle: 'Power Cymbal',
    key: 'C',
    color: '#a855f7', // Violet
    glowColor: 'rgba(168, 85, 247, 0.45)',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/40',
    visualZone: {
      x: 71,
      y: 58,
      width: 24,
      height: 28,
    },
  },
  {
    id: 'snare',
    name: 'Snare',
    subtitle: 'Acoustic Crack',
    key: 'S',
    color: '#10b981', // Emerald
    glowColor: 'rgba(16, 185, 129, 0.45)',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
    visualZone: {
      x: 16,
      y: 7,
      width: 28,
      height: 34,
    },
  },
  {
    id: 'kick',
    name: 'Kick',
    subtitle: 'Deep Bass',
    key: 'K',
    color: '#f43f5e', // Rose
    glowColor: 'rgba(244, 63, 94, 0.45)',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    borderColor: 'border-rose-500/40',
    visualZone: {
      x: 56,
      y: 7,
      width: 28,
      height: 34,
    },
  },
];
