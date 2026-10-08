import { useState } from 'react';
import { Facebook, Instagram, Twitter, Copy, Download, Share2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';

export function SocialSharePanel({ caption, url, ready, onPreview }: {
  caption: string; url: string; ready: boolean; onPreview: () => void;
}) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'x'>('facebook');
  const name = platform === 'facebook' ? 'Facebook' : platform === 'instagram' ? 'Instagram' : 'X / Twitter';
  const platforms = [
    { id: 'facebook' as const, name: 'Facebook', Icon: Facebook, color: 'text-blue-300', active: 'border-blue-500/60 bg-blue-500/15' },
    { id: 'instagram' as const, name: 'Instagram', Icon: Instagram, color: 'text-fuchsia-300', active: 'border-fuchsia-500/60 bg-fuchsia-500/15' },
    { id: 'x' as const, name: 'X / Twitter', Icon: Twitter, color: 'text-zinc-100', active: 'border-zinc-500 bg-zinc-800' },
  ];
  return <section className="space-y-4">
    <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">{t('Choose a platform')}</h3></div>
    <div className="grid grid-cols-3 gap-3">{platforms.map(item => <button key={item.id} type="button" onClick={() => setPlatform(item.id)} aria-pressed={platform === item.id} className={'flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-xs font-bold transition-colors ' + item.color + ' ' + (platform === item.id ? item.active : 'border-zinc-700 bg-zinc-950 hover:bg-zinc-800')}><item.Icon className="h-6 w-6" />{item.name}</button>)}</div>
    <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
      <p className="text-xs font-semibold text-zinc-300">{t('Post preview for {platform}', { platform: name })}</p>
      <label htmlFor="social-share-caption" className="block text-[11px] text-zinc-500">{t('Caption and link')}</label>
      <textarea id="social-share-caption" readOnly rows={3} value={caption + (url ? '\n' + url : '')} onFocus={event => event.target.select()} className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300" />
      <p className="text-[11px] text-zinc-500">{t(platform === 'instagram' ? 'Image and caption for a post or Story.' : 'Result image, caption, and post link.')}</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onPreview} disabled={!ready} className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" />{t('Download PNG')}</button><button type="button" onClick={onPreview} className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-white"><Copy className="h-3.5 w-3.5" />{t('Copy caption')}</button></div>
    </div>
    <button type="button" onClick={onPreview} disabled={!ready} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"><Share2 className="h-4 w-4" />{t('Share to {platform}', { platform: name })}</button>
  </section>;
}
