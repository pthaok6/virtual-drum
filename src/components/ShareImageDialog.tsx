import { SocialSharePanel } from './SocialSharePanel';
import { useChallenges } from '../data/ChallengeLibrary';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useEffect, useState } from 'react';
import { Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReplayClip, USERS } from '../data/community';
import { postUrl } from '../services/community';
import { createResultImage } from '../services/resultImage';

interface ShareImageDialogProps { clip: ReplayClip | null; onClose: () => void }

export function ShareImageDialog({ clip, onClose }: ShareImageDialogProps) {
  const challenges = useChallenges();
  const { t, language, clipTitle } = useLanguage();
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const url = clip?.shared ? postUrl(clip.id, window.location.origin, import.meta.env?.BASE_URL ?? '/') : '';
  const caption = clip ? t('I scored {score} points with {accuracy}% accuracy in Virtual Drum!', { score: clip.score.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'), accuracy: clip.accuracy }) : '';
  useEffect(() => {
    setMessage('');
    if (!clip) { setPreview(''); return; }
    try { setPreview(createResultImage(clip, t(USERS.find(user => user.id === clip.userId)?.name ?? 'Player'), language, challenges)); }
    catch { setPreview(''); setMessage('Could not create an image in this browser.'); }
  }, [clip, language, t, challenges]);

  return <Dialog open={Boolean(clip)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[calc(100vh-2rem)] w-full overflow-y-auto border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl"><ImageIcon className="h-5 w-5 text-rose-400" />{t('Share to social media')}</DialogTitle>
        <DialogDescription className="text-zinc-400">{t('Preview your performance on Facebook, Instagram, X, or another app.')}</DialogDescription>
      </DialogHeader>
      {preview && <img src={preview} alt={t('Result image {title}', { title: clip ? clipTitle(clip) : '' })} className="mx-auto max-h-[35vh] w-auto rounded-xl border border-zinc-700 object-contain" />}
      {url && <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3"><label htmlFor="share-post-url" className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><LinkIcon className="h-3.5 w-3.5" />{t('Post link')}</label><input id="share-post-url" readOnly value={url} onFocus={event => event.target.select()} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300" /></div>}
      <SocialSharePanel key={clip?.id} caption={caption} url={url} ready={Boolean(preview)} onPreview={() => setMessage('This is a sharing preview. Nothing is posted to social media.')} />
      {message && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">{t(message)}</p>}
    </DialogContent>
  </Dialog>;
}
