import { useChallenges } from '../data/ChallengeLibrary';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Share2, Link as LinkIcon, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReplayClip, USERS } from '../data/community';
import { postUrl } from '../services/community';
import { createResultImage } from '../services/resultImage';

interface ShareImageDialogProps {
  clip: ReplayClip | null;
  onClose: () => void;
}

export function ShareImageDialog({ clip, onClose }: ShareImageDialogProps) {
  const challenges = useChallenges();
  const { t, language, clipTitle } = useLanguage();
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const url = clip?.shared ? postUrl(clip.id, window.location.origin, (import.meta.env?.BASE_URL ?? '/')) : '';

  const copyLink = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setMessage('Post link copied.'); }
    catch { setMessage('Could not copy the link. Select and copy it below.'); }
  };

  useEffect(() => {
    if (!clip) { setPreview(''); setMessage(''); return; }
    try {
      setPreview(createResultImage(clip, t(USERS.find((user) => user.id === clip.userId)?.name ?? 'Player'), language, challenges));
      setMessage('');
    } catch {
      setMessage("Could not create an image in this browser.");
    }
  }, [clip, language, t, challenges]);

  const download = () => {
    if (!preview || !clip) return;
    const link = document.createElement('a');
    link.href = preview;
    link.download = `virtual-drum-${clip.id}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const share = async () => {
    if (!preview || !clip || sharing) return;
    setSharing(true);
    try {
      const binary = atob(preview.split(',')[1]);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const file = new File([bytes], `virtual-drum-${clip.id}.png`, { type: 'image/png' });
      const payload: ShareData = { files: [file], title: clipTitle(clip), ...(url ? { text: clipTitle(clip) + '\n' + url, url } : {}) };
      if (!navigator.share || !navigator.canShare?.(payload)) {
        setMessage(url ? 'Your browser cannot share an image and link together. Download the image and copy the post link below.' : 'Your browser does not support direct image sharing. Download the image and post it on your preferred platform.');
        return;
      }
      await navigator.share(payload);
      setMessage('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage("Could not open the share menu. Download the image to post it manually.");
    } finally { setSharing(false); }
  };

  return <Dialog open={Boolean(clip)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[calc(100vh-2rem)] w-full overflow-y-auto border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl"><ImageIcon className="h-5 w-5 text-rose-400" /> {t(clip?.shared ? 'Share post' : 'Result image preview')}</DialogTitle>
        <DialogDescription className="text-zinc-400">{t(clip?.shared ? 'Share your result image and a link to this post.' : 'Your PNG image is ready to share on other platforms.')}</DialogDescription>
      </DialogHeader>
      {preview && <img src={preview} alt={t('Result image {title}', { title: clip ? clipTitle(clip) : '' })} className="mx-auto max-h-[55vh] w-auto rounded-xl border border-zinc-700 object-contain" />}
      {url && <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
        <label htmlFor="share-post-url" className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><LinkIcon className="h-3.5 w-3.5" />{t('Post link')}</label>
        <div className="flex gap-2"><input id="share-post-url" readOnly value={url} onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300" /><button type="button" onClick={copyLink} aria-label={t('Copy post link')} className="rounded-lg bg-zinc-800 px-3 text-zinc-300 hover:bg-zinc-700"><Copy className="h-4 w-4" /></button></div>
        <p className="text-[11px] text-zinc-500">{t('Local demo posts open on this browser. A backend is needed to share new posts across devices.')}</p>
      </div>}
      {message && <p role="status" className="text-sm text-amber-300">{t(message)}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={share} disabled={!preview || sharing} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"><Share2 className="h-4 w-4" /> {t(url ? 'Share image and link' : 'Share image')}</button>
        <button type="button" onClick={download} disabled={!preview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" /> {t("Download PNG")}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
