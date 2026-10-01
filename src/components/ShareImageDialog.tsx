import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReplayClip, USERS } from '../data/community';
import { createResultImage } from '../services/resultImage';

interface ShareImageDialogProps {
  clip: ReplayClip | null;
  onClose: () => void;
}

export function ShareImageDialog({ clip, onClose }: ShareImageDialogProps) {
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!clip) { setPreview(''); setMessage(''); return; }
    try {
      setPreview(createResultImage(clip, USERS.find((user) => user.id === clip.userId)?.name ?? 'Người chơi'));
      setMessage('');
    } catch {
      setMessage('Không thể tạo ảnh trên trình duyệt này.');
    }
  }, [clip]);

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
    if (!preview || !clip) return;
    try {
      const binary = atob(preview.split(',')[1]);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const file = new File([bytes], `virtual-drum-${clip.id}.png`, { type: 'image/png' });
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setMessage('Trình duyệt chưa hỗ trợ chia sẻ ảnh trực tiếp. Hãy tải ảnh rồi đăng lên nền tảng bạn muốn.');
        return;
      }
      await navigator.share({ files: [file], title: clip.title });
      setMessage('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Không thể mở bảng chia sẻ. Bạn có thể tải ảnh để đăng thủ công.');
    }
  };

  return <Dialog open={Boolean(clip)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[calc(100vh-2rem)] w-full overflow-y-auto border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl"><ImageIcon className="h-5 w-5 text-rose-400" /> Xem trước ảnh kết quả</DialogTitle>
        <DialogDescription className="text-zinc-400">Ảnh PNG sẵn sàng để chia sẻ lên nền tảng khác.</DialogDescription>
      </DialogHeader>
      {preview && <img src={preview} alt={`Ảnh kết quả ${clip?.title ?? ''}`} className="mx-auto max-h-[55vh] w-auto rounded-xl border border-zinc-700 object-contain" />}
      {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={share} disabled={!preview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"><Share2 className="h-4 w-4" /> Chia sẻ ảnh</button>
        <button type="button" onClick={download} disabled={!preview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Tải ảnh PNG</button>
      </div>
    </DialogContent>
  </Dialog>;
}
