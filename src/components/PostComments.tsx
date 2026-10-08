import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Reply, Send, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { USERS } from '../data/community';
import type { PostComment } from '../services/community';

export interface CommentActions {
  comments: PostComment[];
  onAddComment: (clipId: string, body: string, parentId?: string) => void;
  onRemoveComment: (id: string) => void;
}

function CommentComposer({ id, onSubmit, replyTo, onCancel }: {
  id: string; onSubmit: (body: string) => void; replyTo?: string; onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const isReply = replyTo !== undefined;
  return <form onSubmit={event => {
    event.preventDefault();
    try { onSubmit(body); setBody(''); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Comment must contain 1–1000 characters.'); }
  }} className="space-y-2">
    {isReply && <p className="text-xs text-rose-300">{t('Replying to {name}', { name: replyTo })}</p>}
    <label htmlFor={id} className="sr-only">{t(isReply ? 'Write a reply' : 'Write a comment')}</label>
    <textarea id={id} value={body} onChange={event => setBody(event.target.value)} maxLength={1000} rows={2} placeholder={t(isReply ? 'Write a reply' : 'Write a comment')} autoFocus={isReply} className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-400" />
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-zinc-500">{body.length}/1000</span>
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white">{t('Cancel')}</button>}
        <button disabled={!body.trim()} className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-40"><Send className="h-3.5 w-3.5" />{t(isReply ? 'Post reply' : 'Post comment')}</button>
      </div>
    </div>
    {error && <p role="alert" className="text-xs text-rose-300">{t(error)}</p>}
  </form>;
}

export function PostComments({ clipId, comments, onAddComment, onRemoveComment, expanded = false }: CommentActions & { clipId: string; expanded?: boolean }) {
  const { t, clipDate } = useLanguage();
  const [open, setOpen] = useState(expanded);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const entries = comments.filter(comment => comment.clipId === clipId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(entries.map(comment => comment.id));
  const roots = entries.filter(comment => !comment.parentId || !ids.has(comment.parentId));
  const panelId = 'comments-' + clipId;

  function renderComment(comment: PostComment, depth = 0) {
    const author = USERS.find(user => user.id === comment.userId);
    const authorName = t(author?.name ?? 'Player');
    const replies = entries.filter(entry => entry.parentId === comment.id);
    const replying = replyToId === comment.id;
    return <article key={comment.id} className="rounded-xl bg-zinc-950/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <Link to={'/profile/' + comment.userId} className="text-xs font-bold text-rose-300">{authorName}</Link>
        <time dateTime={comment.createdAt} className="text-[10px] text-zinc-500">{clipDate(comment.createdAt)}</time>
        {comment.userId === 'you' && <button type="button" onClick={() => { onRemoveComment(comment.id); if (replying) setReplyToId(null); }} aria-label={t('Delete comment')} className="rounded p-1 text-zinc-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">{comment.id.startsWith('comment-') ? t(comment.body) : comment.body}</p>
      <button type="button" onClick={() => setReplyToId(replying ? null : comment.id)} aria-expanded={replying} aria-controls={'reply-form-' + comment.id} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-rose-300"><Reply className="h-3.5 w-3.5" />{t('Reply')}</button>
      {replying && <div id={'reply-form-' + comment.id} className="mt-3"><CommentComposer id={'reply-input-' + comment.id} replyTo={authorName} onCancel={() => setReplyToId(null)} onSubmit={body => { onAddComment(clipId, body, comment.id); setReplyToId(null); }} /></div>}
      {replies.length > 0 && <div className={'mt-3 space-y-3 border-l border-zinc-800 ' + (depth < 2 ? 'pl-3 sm:pl-4' : 'pl-1')}>{replies.map(reply => renderComment(reply, depth + 1))}</div>}
    </article>;
  }

  return <section className="mt-5 border-t border-zinc-800 pt-4">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId} className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white"><MessageCircle className="h-4 w-4" />{t('Comments')} ({entries.length})</button>
    {open && <div id={panelId} className="mt-4 space-y-4">
      {entries.length === 0 && <p className="text-sm text-zinc-500">{t('Be the first to comment.')}</p>}
      <div className="max-h-96 space-y-4 overflow-y-auto" aria-live="polite">{roots.map(comment => renderComment(comment))}</div>
      <CommentComposer id={'comment-input-' + clipId} onSubmit={body => onAddComment(clipId, body)} />
    </div>}
  </section>;
}
