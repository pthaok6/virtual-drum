import type { DrumType } from '../types';

export interface SongAnalysis {
  bpm: number;
  durationSeconds: number;
  analyzedDurationSeconds: number;
  beatTimes: number[];
  notes: { id: string; time: number; lane: DrumType }[];
}

export async function trimAudioFile(file: File, maxSeconds = 120): Promise<File> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration <= maxSeconds) return file;
    const sampleRate = Math.min(44100, decoded.sampleRate);
    const channels = Math.min(2, decoded.numberOfChannels);
    const frames = Math.floor(maxSeconds * sampleRate);
    const offline = new OfflineAudioContext(channels, frames, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const trimmed = await offline.startRendering();
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const writeText = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    writeText(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); writeText(8, 'WAVE');
    writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true); writeText(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    let offset = 44;
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, trimmed.getChannelData(channel)[frame]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([bytes], `${baseName}.wav`, { type: 'audio/wav' });
  } catch {
    throw new Error('Could not trim this audio in your browser. Try a WAV, MP3, or OGG file.');
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function analyzeSongFile(file: File, signal?: AbortSignal): Promise<SongAnalysis> {
  const body = new FormData();
  body.append('file', file);
  let response: Response;
  try {
    response = await fetch('/api/analyze', { method: 'POST', body, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Analysis server is unavailable. Start the Python backend and try again.');
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? 'Could not analyze this audio file. Try another file.');
  }
  const result = await response.json() as Omit<SongAnalysis, 'notes'> & { notes: { time: number; lane: DrumType }[] };
  return { ...result, notes: result.notes.map((note, index) => ({ ...note, id: String(index) })) };
}
