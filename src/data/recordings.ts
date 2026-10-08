import type { RhythmChallenge, DrumType } from '../types';
import { prepareSong } from '../services/songExperience';

// Real recordings with explicitly illustrative charts for this frontend prototype.
const recordings = [
  { id: 'greensleeves', title: 'Greensleeves', artist: 'Traditional · CambridgeBayWeather', genre: 'Folk', bpm: 90, durationSeconds: 78.7591836734694, color: 'from-emerald-400 via-teal-700 to-zinc-950', credit: { name: 'CambridgeBayWeather', url: 'https://commons.wikimedia.org/wiki/File:Greensleeves.ogg', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/' } },
  { id: 'ode-to-joy', title: 'Ode to Joy', artist: 'Beethoven · U.S. Navy Band', genre: 'Classical', bpm: 112, durationSeconds: 60.957800453514736, color: 'from-amber-300 via-yellow-700 to-zinc-950', credit: { name: 'U.S. Navy Band', url: 'https://commons.wikimedia.org/wiki/File:Anthem_of_Europe_(US_Navy_instrumental_short_version).ogg', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/' } },
];
export const RECORDING_CHALLENGES: RhythmChallenge[] = recordings.map(song => {
  const stepMs = 30000 / song.bpm;
  const pattern: DrumType[] = ['kick', 'hihat', 'snare', 'hihat', 'kick', 'hihat', 'snare', 'tom'];
  const notes = Array.from({ length: Math.floor((song.durationSeconds * 1000 - 2200) / stepMs) }, (_, index) => ({ id: song.id + '-' + index, drum: pattern[index % 8], timeMs: Math.round(1800 + index * stepMs) }));
  return prepareSong({ id: song.id, title: song.title, artist: song.artist, difficulty: 'Easy', bpm: song.bpm, durationSeconds: song.durationSeconds, description: 'A real recording with an illustrative drum chart for the frontend preview.', music: { src: 'audio/' + song.id + '.ogg', introMs: 1800 }, notes }, { genre: song.genre, color: song.color, source: 'recording', chartSource: 'demo', credit: song.credit });
});
