import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Play, Search, Send, Share2, UserPlus } from 'lucide-react';
import { Avatar, Missing, PageHeading } from './CommunityScreens';
import { USERS, type ReplayClip } from '../data/community';
import { useChallenges } from '../data/ChallengeLibrary';
import { useLanguage } from '../i18n/LanguageProvider';
import { searchUsers, conversationMessages, type DirectMessage } from '../services/community';
import { PostComments, type CommentActions } from '../components/PostComments';
import { createResultImage } from '../services/resultImage';

const card = 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-700';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-40';

export function UserSearchScreen({ following, onFollow }: { following: string[]; onFollow: (id: string) => void }) {
  const { t, locale } = useLanguage();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const results = searchUsers(USERS, query);
  return <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
    <PageHeading eyebrow={t('Community')} title={t('Find players')} description={t('Search by player name or handle, follow their performances, or start a conversation.')} />
    <label htmlFor="player-search" className="mb-2 block text-sm font-semibold text-zinc-300">{t('Search users')}</label>
    <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" /><input id="player-search" type="search" maxLength={100} value={query} onChange={event => setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })} placeholder={t('Name or @handle')} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-12 pr-4 text-white outline-none focus:border-rose-400" /></div>
    <p role="status" className="my-4 text-xs text-zinc-500">{t('{count} players found', { count: results.length })}</p>
    <div className="space-y-3">{results.map(user => <article key={user.id} className={card + ' flex flex-wrap items-center gap-4'}><Avatar user={user} /><div className="min-w-0 flex-1"><Link to={'/profile/' + user.id} className="font-bold text-white hover:text-rose-300">{t(user.name)}</Link><p className="text-xs text-zinc-500">{user.handle} · {user.followers.toLocaleString(locale)} {t('Followers')}</p><p className="mt-1 text-sm text-zinc-400">{t(user.bio)}</p></div>{user.id !== 'you' && <div className="flex gap-2"><button onClick={() => onFollow(user.id)} className={button}><UserPlus className="h-4 w-4" />{t(following.includes(user.id) ? 'Following' : 'Follow')}</button><Link to={'/messages/' + user.id} className={primary}><MessageCircle className="h-4 w-4" />{t('Message')}</Link></div>}</article>)}</div>
    {results.length === 0 && <div className={card}><h2 className="font-bold text-white">{t('No players found')}</h2><p className="mt-1 text-sm text-zinc-400">{t('Try another name or handle.')}</p></div>}
  </div>;
}

export function MessagesScreen({ messages, onSendMessage, onMarkRead }: { messages: DirectMessage[]; onSendMessage: (userId: string, body: string) => void; onMarkRead: (userId: string) => void }) {
  const { t, clipDate } = useLanguage();
  const { userId } = useParams();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const user = USERS.find(entry => entry.id === userId && entry.id !== 'you');
  const conversation = user ? conversationMessages(messages, user.id) : [];
  const people = searchUsers(USERS.filter(entry => entry.id !== 'you'), query).sort((a, b) => {
    const left = conversationMessages(messages, a.id).at(-1)?.createdAt ?? '';
    const right = conversationMessages(messages, b.id).at(-1)?.createdAt ?? '';
    return right.localeCompare(left);
  });
  useEffect(() => { setDraft(''); setError(''); if (userId) onMarkRead(userId); }, [userId, onMarkRead]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); if (userId) onMarkRead(userId); }, [messages, userId, onMarkRead]);
  if (userId && !user) return <Missing />;
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <PageHeading eyebrow={t('Community')} title={t('Messages')} description={t('Local demo conversations are saved in this browser. Messages are not delivered to other devices.')} />
    <div className="grid overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 md:grid-cols-[280px_1fr]">
      <aside className="border-b border-zinc-800 p-4 md:border-b-0 md:border-r"><label htmlFor="chat-search" className="sr-only">{t('Search users')}</label><input id="chat-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search users')} className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-rose-400" /><nav aria-label={t('Conversations')} className="space-y-2">{people.map(person => {
        const entries = conversationMessages(messages, person.id);
        const last = entries.at(-1);
        const unread = entries.filter(message => message.recipientId === 'you' && !message.read).length;
        return <Link key={person.id} to={'/messages/' + person.id} className={'flex items-center gap-3 rounded-xl p-3 ' + (person.id === userId ? 'bg-rose-500/15' : 'hover:bg-zinc-800')} aria-current={person.id === userId ? 'page' : undefined}><Avatar user={person} size="h-10 w-10" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{person.name}</p><p className="truncate text-xs text-zinc-500">{last ? last.id.startsWith('message-') ? t(last.body) : last.body : t('Start a conversation')}</p></div>{unread > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>}</Link>;
      })}{people.length === 0 && <p className="text-xs text-zinc-500">{t('No players found')}</p>}</nav><Link to="/users" className={button + ' mt-4 w-full'}><Search className="h-4 w-4" />{t('Find players')}</Link></aside>
      {!user ? <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center"><MessageCircle className="mb-4 h-12 w-12 text-rose-400" /><h2 className="text-xl font-bold text-white">{t('Choose a conversation')}</h2><p className="mt-2 text-sm text-zinc-400">{t('Select a player to read or write messages.')}</p></div> : <section className="flex min-h-[500px] flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-800 p-4"><Avatar user={user} size="h-10 w-10" /><Link to={'/profile/' + user.id} className="font-bold text-white hover:text-rose-300">{user.name}</Link><span className="ml-auto text-xs text-zinc-500">{t('Demo')}</span></header>
        <div className="max-h-[55vh] min-h-72 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label={t('Conversation messages')} aria-live="polite">{conversation.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">{t('Say hello to start the conversation.')}</p>}{conversation.map(message => <article key={message.id} className={'flex ' + (message.senderId === 'you' ? 'justify-end' : 'justify-start')}><div className={'max-w-[85%] rounded-2xl px-4 py-3 ' + (message.senderId === 'you' ? 'bg-rose-500/20 text-rose-100' : 'bg-zinc-800 text-zinc-200')}><p className="whitespace-pre-wrap break-words text-sm">{message.id.startsWith('message-') ? t(message.body) : message.body}</p><time dateTime={message.createdAt} className="mt-2 block text-[10px] text-zinc-500">{clipDate(message.createdAt)}</time></div></article>)}<div ref={endRef} /></div>
        <form onSubmit={event => { event.preventDefault(); try { onSendMessage(user.id, draft); setDraft(''); setError(''); } catch { setError('Message must contain 1–2000 characters.'); } }} className="border-t border-zinc-800 p-4"><label htmlFor="message-input" className="sr-only">{t('Write a message')}</label><div className="flex items-end gap-3"><textarea id="message-input" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={t('Write a message')} className="min-w-0 flex-1 resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-400" /><button disabled={!draft.trim()} className={primary}><Send className="h-4 w-4" />{t('Send')}</button></div><p className="mt-2 text-right text-[10px] text-zinc-500">{draft.length}/2000</p>{error && <p role="alert" className="text-xs text-rose-300">{t(error)}</p>}</form>
      </section>}
    </div>
  </div>;
}

export function PostScreen({ clips, onShareImage, comments, onAddComment, onRemoveComment }: CommentActions & { clips: ReplayClip[]; onShareImage: (id: string) => void }) {
  const challenges = useChallenges();
  const { t, language, locale, clipTitle, clipDate } = useLanguage();
  const { clipId } = useParams();
  const clip = clips.find(entry => entry.id === clipId && entry.shared);
  const author = USERS.find(user => user.id === clip?.userId);
  const [image, setImage] = useState('');
  useEffect(() => {
    setImage('');
    if (clip && author) { try { setImage(createResultImage(clip, t(author.name), language, challenges)); } catch { /* Keep the post and comments available without canvas support. */ } }
  }, [clip, author, language, t, challenges]);
  if (!clip || !author) return <Missing />;
  return <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><Link to={'/profile/' + author.id} className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" />{t('Back to profile')}</Link><article className={card}><div className="mb-5 flex items-center gap-3"><Avatar user={author} /><div><Link to={'/profile/' + author.id} className="font-bold text-white hover:text-rose-300">{t(author.name)}</Link><p className="text-xs text-zinc-500">{clipDate(clip.date)}</p></div></div><h1 className="text-2xl font-black text-white">{clipTitle(clip)}</h1><p className="mt-1 text-sm text-zinc-400">{t(challenges.find(challenge => challenge.id === clip.challengeId)?.title ?? 'Challenge')}</p>{image && <img src={image} alt={t('Result image {title}', { title: clipTitle(clip) })} className="mt-5 w-full rounded-2xl border border-zinc-800" />}<div className="mt-5 flex flex-wrap items-center gap-5 text-sm"><strong className="text-amber-300">{clip.score.toLocaleString(locale)} {t('points')}</strong><span className="text-emerald-400">{clip.accuracy}{t('% accuracy')}</span><span className="text-rose-300">{t('Rank')} {clip.rank}</span></div><div className="mt-5 flex flex-wrap gap-3"><Link to={'/replay/' + clip.id} className={primary}><Play className="h-4 w-4" />{t('Replay')}</Link><button onClick={() => onShareImage(clip.id)} className={button}><Share2 className="h-4 w-4" />{t('Share post')}</button></div><PostComments clipId={clip.id} comments={comments} onAddComment={onAddComment} onRemoveComment={onRemoveComment} expanded /></article></div>;
}
