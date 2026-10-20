import { DrumType } from '../types';

export const DRUM_KITS = [
  { id: 'hard-trap', name: 'Hard Trap' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'soulful-vintage', name: 'Soulful Vintage' },
] as const;
export type DrumKitId = typeof DRUM_KITS[number]['id'];

const KIT_SAMPLE_FILES: Record<DrumKitId, Record<DrumType, string>> = {
  'hard-trap': {
    kick: 'kits/hard-trap/kick.wav', snare: 'kits/hard-trap/snare.wav',
    hihat: 'kits/hard-trap/hihat.wav', tom: 'kits/hard-trap/tom.wav', crash: 'kits/hard-trap/crash.wav',
  },
  bounce: {
    kick: 'kick.wav', snare: 'snare.wav', hihat: 'hihat.wav', tom: 'tom.wav', crash: 'crash.wav',
  },
  'soulful-vintage': {
    kick: 'kits/soulful-vintage/kick.wav', snare: 'kits/soulful-vintage/snare.wav',
    hihat: 'kits/soulful-vintage/hihat.wav', tom: 'kits/soulful-vintage/tom.wav', crash: 'kits/soulful-vintage/crash.wav',
  },
};
const DRUM_KIT_STORAGE_KEY = 'virtual-drum-kit';

class DrumAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.85;
  private sampleBuffers: Partial<Record<DrumKitId, Partial<Record<DrumType, AudioBuffer>>>> = {};
  private samplesPromise: Promise<void> | null = null;
  private selectedKit: DrumKitId = this.readSavedKit();

  private readSavedKit(): DrumKitId {
    try {
      const saved = localStorage.getItem(DRUM_KIT_STORAGE_KEY);
      return DRUM_KITS.find(kit => kit.id === saved)?.id ?? 'bounce';
    } catch {
      return 'bounce';
    }
  }

  public getDrumKit(): DrumKitId { return this.selectedKit; }

  public setDrumKit(kit: DrumKitId) {
    this.selectedKit = kit;
    try { localStorage.setItem(DRUM_KIT_STORAGE_KEY, kit); } catch { /* Keep selection for this session. */ }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        void this.loadSamples();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public async unlock() {
    this.initContext();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    await this.loadSamples();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  private loadSamples(): Promise<void> {
    const context = this.ctx;
    if (!context) return Promise.resolve();
    if (this.samplesPromise) return this.samplesPromise;
    const base = import.meta.env.BASE_URL;
    this.samplesPromise = Promise.all(Object.entries(KIT_SAMPLE_FILES).map(async ([kit, files]) => {
      const decoded = await Promise.all(Object.entries(files).map(async ([drum, file]) => {
        try {
          const response = await fetch(`${base}audio/drums/${file}`);
          if (!response.ok) return null;
          const audioData = await response.arrayBuffer();
          return [drum as DrumType, await context.decodeAudioData(audioData)] as const;
        } catch {
          return null;
        }
      }));
      this.sampleBuffers[kit as DrumKitId] = Object.fromEntries(decoded.filter((item): item is NonNullable<typeof item> => item !== null));
    })).then(() => undefined);
    return this.samplesPromise;
  }

  private playSample(drum: DrumType, time: number, kit: DrumKitId = this.selectedKit): boolean {
    const buffer = this.sampleBuffers[kit]?.[drum];
    if (!this.ctx || !this.masterGain || !buffer) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    source.start(time);
    return true;
  }

  // Play realistic synthesized drum sounds
  public playDrum(drum: DrumType) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    if (this.playSample(drum, t)) return;
    if (this.samplesPromise) {
      const kit = this.selectedKit;
      void this.samplesPromise.then(() => {
        if (!this.ctx || this.isMuted) return;
        const playTime = this.ctx.currentTime;
        if (!this.playSample(drum, playTime, kit)) this.playSynthesizedDrum(drum, playTime);
      });
      return;
    }
    this.playSynthesizedDrum(drum, t);
  }

  private playSynthesizedDrum(drum: DrumType, t: number) {
    switch (drum) {
      case 'kick':
        this.playKick(t);
        break;
      case 'snare':
        this.playSnare(t);
        break;
      case 'hihat':
        this.playHiHat(t);
        break;
      case 'tom':
        this.playTom(t);
        break;
      case 'crash':
        this.playCrash(t);
        break;
    }
  }

  // Punchy acoustic/808 Kick
  private playKick(t: number) {
    if (!this.ctx || !this.masterGain) return;

    // Body oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.36);

    // Initial click/transient for punch
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(300, t);
    clickOsc.frequency.exponentialRampToValueAtTime(60, t + 0.02);

    clickGain.gain.setValueAtTime(0.6, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);

    clickOsc.start(t);
    clickOsc.stop(t + 0.03);
  }

  // Snappy acoustic Snare with body + snares wire noise
  private playSnare(t: number) {
    if (!this.ctx || !this.masterGain) return;

    // Snare tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);

    oscGain.gain.setValueAtTime(0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);

    // Snare noise
    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.22);
  }

  // Crisp Hi-Hat
  private playHiHat(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.07;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(9500, t);
    filter.Q.setValueAtTime(1.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.07);
  }

  // Deep resonant Tom
  private playTom(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.18);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.29);
  }

  // Shimmering Crash Cymbal
  private playCrash(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const duration = 1.2;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(4500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  // UI / Rhythm Feedback SFX
  public playHitSound(rating: 'perfect' | 'good' | 'miss') {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (rating === 'perfect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t); // A5
      osc.frequency.setValueAtTime(1320, t + 0.05); // E6
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    } else if (rating === 'good') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t); // E5
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.13);
    } else if (rating === 'miss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.19);
    }
  }

  public playCountdownBeep(highPitch: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(highPitch ? 880 : 440, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }
}

export const audioEngine = new DrumAudioEngine();
