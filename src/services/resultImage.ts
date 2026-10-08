import type { RhythmChallenge } from '../types';
import { clipTitle, languageLocale, translate, type Language } from '../i18n/translate';
import { ReplayClip } from '../data/community';
import { CHALLENGES } from '../data/challenges';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

export function createResultImage(clip: ReplayClip, playerName: string, language: Language = 'en', challenges: RhythmChallenge[] = CHALLENGES): string {
  const t = (text: string) => translate(text, language);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('Could not create the result image.'));

  const background = ctx.createLinearGradient(0, 0, 1080, 1080);
  background.addColorStop(0, '#18181b');
  background.addColorStop(0.55, '#09090b');
  background.addColorStop(1, '#381522');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(850, 190, 40, 850, 190, 650);
  glow.addColorStop(0, 'rgba(244,63,94,0.22)');
  glow.addColorStop(1, 'rgba(244,63,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillText('VIRTUAL DRUM', 72, 105);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '26px Arial, sans-serif';
  ctx.fillText(t('RHYTHM CHALLENGE RESULTS'), 72, 162);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Arial, sans-serif';
  const translatedTitle = clipTitle(clip, language);
  const title = translatedTitle.length > 27 ? `${translatedTitle.slice(0, 26)}…` : translatedTitle;
  ctx.fillText(title, 72, 270);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText(`${playerName}  •  ${t(challenges.find((challenge) => challenge.id === clip.challengeId)?.title ?? 'Challenge')}`, 72, 326);

  ctx.fillStyle = '#27272a';
  roundRect(ctx, 72, 386, 936, 410, 36);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 158px Arial, sans-serif';
  ctx.fillText(clip.rank, 122, 592);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(t('TOTAL SCORE'), 365, 493);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 100px Arial, sans-serif';
  ctx.fillText(clip.score.toLocaleString(languageLocale(language)), 365, 610);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText(`${clip.accuracy}${t('% accuracy')}`, 365, 685);

  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText(t('Keep the beat. Share the inspiration.'), 72, 905);
  ctx.fillStyle = '#71717a';
  ctx.font = '26px Arial, sans-serif';
  ctx.fillText('virtual-drum  /  rhythm challenge', 72, 959);
  return canvas.toDataURL('image/png');
}
