import { DrumKitPreset, DrumType, RecordedHit, UserRecording } from '../types';

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV format Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings to DataView
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM channel samples
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Creates noise buffer for snare, hi-hat and cymbal synthesis
 */
function createNoiseBuffer(ctx: BaseAudioContext, seconds: number = 2.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Synthesize a single drum hit into an OfflineAudioContext
 */
function scheduleOfflineDrum(
  ctx: OfflineAudioContext,
  masterGain: GainNode,
  noiseBuffer: AudioBuffer,
  drum: DrumType,
  t: number,
  vel: number,
  preset: DrumKitPreset
) {
  const v = Math.max(0.2, Math.min(1.2, vel));

  switch (drum) {
    case 'kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset === 'electronic' ? 'sine' : 'sine';
      const startFreq = preset === 'electronic' ? 160 : 145 + 15 * v;
      const endFreq = preset === 'electronic' ? 38 : 45;
      const decay = preset === 'electronic' ? 0.45 : 0.38;

      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.09);

      gain.gain.setValueAtTime(1.1 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + decay + 0.02);

      // Punch click
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(320 * v, t);
      click.frequency.exponentialRampToValueAtTime(70, t + 0.02);
      clickGain.gain.setValueAtTime(0.65 * v, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      click.connect(clickGain);
      clickGain.connect(masterGain);
      click.start(t);
      click.stop(t + 0.03);
      break;
    }

    case 'snare': {
      // Body tone
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + 20 * v, t);
      osc.frequency.exponentialRampToValueAtTime(125, t + 0.07);
      oscGain.gain.setValueAtTime(0.85 * v, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.2);

      // Snare rattle noise
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1800, t);
      bandpass.Q.setValueAtTime(1.2, t);

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(800, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1.0 * v, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      noise.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 0.25);
      break;
    }

    case 'hihat': {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, t);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(10000, t);
      bandpass.Q.setValueAtTime(3.0, t);

      const gain = ctx.createGain();
      const decay = 0.065;
      gain.gain.setValueAtTime(0.8 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

      noise.connect(filter);
      filter.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + decay + 0.02);
      break;
    }

    case 'tom': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.12);
      gain.gain.setValueAtTime(0.95 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
      break;
    }

    case 'crash': {
      // Inharmonic dual osc ring
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc1.type = 'square';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(410, t);
      osc2.frequency.setValueAtTime(580, t);

      oscGain.gain.setValueAtTime(0.4 * v, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc1.connect(oscGain);
      osc2.connect(oscGain);
      oscGain.connect(masterGain);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.85);
      osc2.stop(t + 0.85);

      // Sizzling cymbal noise
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5500, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.1 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(t);
      noise.stop(t + 1.45);
      break;
    }
  }
}

/**
 * Render drum hits sequence to high quality WAV Blob
 */
export async function renderHitsToWav(
  hits: RecordedHit[],
  durationMs: number,
  preset: DrumKitPreset = 'acoustic'
): Promise<Blob> {
  const sampleRate = 44100;
  // Ensure enough room for cymbal and reverb tails (add 1.2s padding)
  const totalDurationSeconds = Math.max(1.5, (durationMs + 1200) / 1000);
  const totalFrames = Math.ceil(totalDurationSeconds * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);
  masterGain.connect(offlineCtx.destination);

  const noiseBuffer = createNoiseBuffer(offlineCtx, 3.0);

  // Schedule all drum hits
  for (const hit of hits) {
    const t = Math.max(0, hit.timestampMs / 1000);
    scheduleOfflineDrum(
      offlineCtx,
      masterGain,
      noiseBuffer,
      hit.drum,
      t,
      hit.velocity ?? 0.85,
      preset
    );
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

/**
 * Trigger file download in browser
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Export recording as downloadable JSON file
 */
export function exportRecordingToJson(recording: UserRecording) {
  const jsonStr = JSON.stringify(recording, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const safeTitle = recording.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(blob, `${safeTitle || 'drum-track'}.json`);
}

/**
 * Generate shareable URL or payload
 */
export function generateSharePayload(recording: UserRecording): {
  url: string;
  shareText: string;
} {
  // Compress basic track info into URL query parameters
  const compactHits = recording.hits.map((h) => ({
    d: h.drum,
    t: h.timestampMs,
    v: Math.round((h.velocity ?? 0.85) * 100) / 100,
  }));

  const payload = {
    t: recording.title,
    d: recording.durationMs,
    p: recording.preset,
    h: compactHits,
  };

  const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
  const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

  const shareText = `🥁 Check out my virtual drum jam: "${recording.title}" (${(recording.durationMs / 1000).toFixed(1)}s, ${recording.hits.length} hits) on Virtual Drum!`;

  return { url, shareText };
}

/**
 * Parse shared recording from URL if present
 */
export function parseSharedRecordingFromUrl(): UserRecording | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (!shareParam) return null;

    const jsonStr = atob(decodeURIComponent(shareParam));
    const data = JSON.parse(jsonStr);

    if (!data || !Array.isArray(data.h)) return null;

    const hits: RecordedHit[] = data.h.map((h: any, idx: number) => ({
      id: `shared-hit-${idx}`,
      drum: h.d,
      timestampMs: h.t,
      velocity: h.v ?? 0.85,
    }));

    return {
      id: `shared-${Date.now()}`,
      title: data.t || 'Shared Drum Recording',
      hits,
      durationMs: data.d || 4000,
      preset: data.p || 'acoustic',
      createdAt: Date.now(),
      authorName: 'Shared Musician',
    };
  } catch (e) {
    console.warn('Failed to parse shared recording:', e);
    return null;
  }
}
