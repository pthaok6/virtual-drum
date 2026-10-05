import { DrumKitPreset, DrumType } from '../types';

class DrumAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.85;
  private currentPreset: DrumKitPreset = 'acoustic';

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
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

  public setPreset(preset: DrumKitPreset) {
    this.currentPreset = preset;
  }

  public getPreset(): DrumKitPreset {
    return this.currentPreset;
  }

  /**
   * Main entry point to play drum with velocity and preset
   * @param drum The drum pad
   * @param velocity 0.1 to 1.0 (strike intensity)
   * @param preset Optional kit override
   */
  public playDrum(drum: DrumType, velocity: number = 0.85, preset?: DrumKitPreset) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    // Clamp and normalize velocity
    const vel = Math.max(0.2, Math.min(1.2, velocity));
    const activePreset = preset || this.currentPreset;
    const t = this.ctx.currentTime;

    switch (activePreset) {
      case 'electronic':
        this.play808Kit(drum, t, vel);
        break;
      case 'rock':
        this.playRockKit(drum, t, vel);
        break;
      case 'acoustic':
      default:
        this.playAcousticKit(drum, t, vel);
        break;
    }
  }

  // ==========================================
  // PRESET 1: ACOUSTIC STUDIO KIT
  // ==========================================
  private playAcousticKit(drum: DrumType, t: number, vel: number) {
    switch (drum) {
      case 'kick':
        this.synthAcousticKick(t, vel);
        break;
      case 'snare':
        this.synthAcousticSnare(t, vel);
        break;
      case 'hihat':
        this.synthAcousticHiHat(t, vel);
        break;
      case 'tom':
        this.synthAcousticTom(t, vel);
        break;
      case 'crash':
        this.synthAcousticCrash(t, vel);
        break;
    }
  }

  private synthAcousticKick(t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(145 + 15 * vel, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);

    const kickVol = 1.0 * vel;
    gain.gain.setValueAtTime(kickVol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.39);

    // Punch transient
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(320 * vel, t);
    click.frequency.exponentialRampToValueAtTime(70, t + 0.02);

    clickGain.gain.setValueAtTime(0.65 * vel, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    click.connect(clickGain);
    clickGain.connect(this.masterGain);
    click.start(t);
    click.stop(t + 0.03);
  }

  private synthAcousticSnare(t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    // Snare tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);

    oscGain.gain.setValueAtTime(0.7 * vel, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);

    // Snare wire noise with dynamic filter cutoff
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800 + 400 * vel, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85 * vel, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.23);
  }

  private synthAcousticHiHat(t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(9500 + 1000 * vel, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.75 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.07);
  }

  private synthAcousticTom(t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 + 20 * vel, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.18);

    gain.gain.setValueAtTime(0.95 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.31);
  }

  private synthAcousticCrash(t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    const duration = 1.25;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85 * vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  // ==========================================
  // PRESET 2: 808 ELECTRONIC HIP-HOP KIT
  // ==========================================
  private play808Kit(drum: DrumType, t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    switch (drum) {
      case 'kick': {
        // Long boom sub bass 808
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

        gain.gain.setValueAtTime(1.1 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.66);
        break;
      }
      case 'snare': {
        // Tight 808 clap/snare
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(170, t + 0.05);
        oscGain.gain.setValueAtTime(0.6 * vel, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.11);

        // Clap-like bursts
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9 * vel, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.15);
        break;
      }
      case 'hihat': {
        // Sizzly metallic 808 hat
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(11000, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.05);
        break;
      }
      case 'tom': {
        // 808 Synth Tom
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180 * vel, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

        gain.gain.setValueAtTime(0.9 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.26);
        break;
      }
      case 'crash': {
        // 808 Splash Cymbal
        const duration = 1.0;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(6000, t);
        filter.Q.setValueAtTime(2.0, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.75 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + duration);
        break;
      }
    }
  }

  // ==========================================
  // PRESET 3: HARD ROCK KIT
  // ==========================================
  private playRockKit(drum: DrumType, t: number, vel: number) {
    if (!this.ctx || !this.masterGain) return;

    switch (drum) {
      case 'kick': {
        // Heavy, gated rock kick with deep body
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(170, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);

        gain.gain.setValueAtTime(1.2 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.29);

        // Clicky beater
        const click = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        click.type = 'sawtooth';
        click.frequency.setValueAtTime(550, t);
        click.frequency.exponentialRampToValueAtTime(100, t + 0.015);
        clickGain.gain.setValueAtTime(0.75 * vel, t);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        click.connect(clickGain);
        clickGain.connect(this.masterGain);
        click.start(t);
        click.stop(t + 0.022);
        break;
      }
      case 'snare': {
        // Cracking rimshot snare with high ring
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(245, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);
        oscGain.gain.setValueAtTime(0.85 * vel, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.17);

        // Rock Snare Noise
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.95 * vel, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.27);
        break;
      }
      case 'hihat': {
        // Loud, washy rock hat
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.11);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(8000, t);
        filter.Q.setValueAtTime(1.2, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.11);
        break;
      }
      case 'tom': {
        // Floor tom
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110 + 20 * vel, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.25);

        gain.gain.setValueAtTime(1.1 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.39);
        break;
      }
      case 'crash': {
        // Explosive power crash
        const duration = 1.6;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(3800, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.0 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + duration);
        break;
      }
    }
  }

  // ==========================================
  // FEEDBACK SFX
  // ==========================================
  public playHitSound(rating: 'perfect' | 'good' | 'miss') {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (rating === 'perfect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.05);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    } else if (rating === 'good') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t);
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
