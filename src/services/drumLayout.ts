import { DrumType, NormalizedZone } from '../types';
import { DRUMS } from '../data/drums';

export type DrumLayoutMap = Record<DrumType, NormalizedZone>;

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: DrumLayoutMap;
}

export const DEFAULT_DRUM_LAYOUT: DrumLayoutMap = {
  hihat: { x: 5, y: 58, width: 24, height: 28 },
  tom: { x: 38, y: 54, width: 24, height: 28 },
  crash: { x: 71, y: 58, width: 24, height: 28 },
  snare: { x: 16, y: 7, width: 28, height: 34 },
  kick: { x: 56, y: 7, width: 28, height: 34 },
};

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    name: 'Standard Kit',
    description: 'Balanced arrangement for standard webcam distance',
    layout: DEFAULT_DRUM_LAYOUT,
  },
  {
    id: 'wide',
    name: 'Wide Wingspan',
    description: 'Spaced out for full arm extension and sitting further back',
    layout: {
      hihat: { x: 2, y: 58, width: 24, height: 28 },
      tom: { x: 38, y: 54, width: 24, height: 28 },
      crash: { x: 74, y: 58, width: 24, height: 28 },
      snare: { x: 8, y: 7, width: 28, height: 34 },
      kick: { x: 64, y: 7, width: 28, height: 34 },
    },
  },
  {
    id: 'compact',
    name: 'Compact Center',
    description: 'Grouped closer for close-up webcam seating and minimal movement',
    layout: {
      hihat: { x: 14, y: 56, width: 22, height: 26 },
      tom: { x: 39, y: 54, width: 22, height: 26 },
      crash: { x: 64, y: 56, width: 22, height: 26 },
      snare: { x: 24, y: 10, width: 24, height: 30 },
      kick: { x: 52, y: 10, width: 24, height: 30 },
    },
  },
  {
    id: 'arc',
    name: 'Ergonomic Arc',
    description: 'Smooth semi-circular cockpit shape aligned with arm swing',
    layout: {
      hihat: { x: 4, y: 44, width: 22, height: 28 },
      snare: { x: 22, y: 18, width: 26, height: 30 },
      tom: { x: 39, y: 54, width: 22, height: 26 },
      kick: { x: 56, y: 18, width: 26, height: 30 },
      crash: { x: 74, y: 44, width: 22, height: 28 },
    },
  },
];

const STORAGE_KEY = 'virtual_drum_custom_layout';

class DrumLayoutService {
  private currentLayout: DrumLayoutMap;
  private listeners: Set<(layout: DrumLayoutMap) => void> = new Set();

  constructor() {
    this.currentLayout = this.loadFromStorage();
  }

  private loadFromStorage(): DrumLayoutMap {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate all 5 drums exist
        const allDrumsPresent = DRUMS.every((d) => parsed[d.id] && typeof parsed[d.id].x === 'number');
        if (allDrumsPresent) {
          return parsed as DrumLayoutMap;
        }
      }
    } catch (e) {
      console.warn('Failed to load custom drum layout, using default:', e);
    }
    return { ...DEFAULT_DRUM_LAYOUT };
  }

  public getLayout(): DrumLayoutMap {
    return { ...this.currentLayout };
  }

  public getZone(drum: DrumType): NormalizedZone {
    return this.currentLayout[drum] || DEFAULT_DRUM_LAYOUT[drum];
  }

  public setLayout(newLayout: DrumLayoutMap) {
    this.currentLayout = { ...newLayout };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentLayout));
    } catch (e) {
      console.warn('Failed to save drum layout to localStorage:', e);
    }
    this.notifyListeners();
  }

  public setPreset(presetId: string): DrumLayoutMap {
    const preset = LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      this.setLayout(preset.layout);
      return { ...preset.layout };
    }
    return this.getLayout();
  }

  public resetToDefault(): DrumLayoutMap {
    this.setLayout(DEFAULT_DRUM_LAYOUT);
    return { ...DEFAULT_DRUM_LAYOUT };
  }

  public subscribe(listener: (layout: DrumLayoutMap) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLayout());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getLayout()));
  }
}

export const drumLayoutService = new DrumLayoutService();
