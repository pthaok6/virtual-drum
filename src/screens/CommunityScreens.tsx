import { PostComments, type CommentActions } from '../components/PostComments';
import { postPath } from '../services/community';
import { useLanguage } from '@/i18n/LanguageProvider';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, Check, Crown, Eye, LockKeyhole,
  Pause, Play, Plus, Radio, Share2, Trophy, UserPlus, Users,
  MessageCircle, Swords, Music, Drum, LogOut, Copy, Send, Sparkles, CheckCircle2
} from 'lucide-react';
import { useChallenges } from '../data/ChallengeLibrary';
import { CommunityUser, ReplayClip, ROOMS, USERS } from '../data/community';
import { GameResult, RhythmChallenge } from '../types';
import { audioEngine } from '../services/audio';
import { useAuth } from '../context/AuthContext';
import { fetchRooms, createRoom, type RoomData } from '../services/roomService';
import { useRoomRealtime } from '../hooks/useRoomRealtime';

const card = 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:opacity-90 transition disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 transition disabled:opacity-50';

export function Avatar({ user, size = 'h-12 w-12' }: { user: CommunityUser; size?: string }) {
  return <div className={`${size} shrink-0 rounded-2xl bg-gradient-to-br ${user.color} flex items-center justify-center font-black text-zinc-950 shadow-lg`}>{user.initials}</div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-400">{eyebrow}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p></div>;
}

export function Leaderboard({ onFollow, following }: { onFollow: (id: string) => void; following: string[] }) {
  const { t, locale } = useLanguage();
  return <section id="leaderboard" className="mt-14 w-full scroll-mt-24">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">{t("Community")}</p><h2 className="mt-1 text-2xl font-black text-white">{t("Leaderboard")}</h2><p className="mt-1 text-sm text-zinc-400">{t("This week's top scores · demo data")}</p></div><Link to="/rooms" className="text-sm font-semibold text-rose-300 hover:text-rose-200">{t("Join a room")} <ArrowRight className="inline h-4 w-4" /></Link></div>
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">{[...USERS].sort((a,b) => b.totalScore-a.totalScore).map((user, index) => <div key={user.id} className="flex items-center gap-3 border-b border-zinc-800/70 p-3 last:border-0 sm:gap-5 sm:p-4"><span className={`w-8 text-center text-lg font-black ${index === 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{index === 0 ? <Crown className="mx-auto h-5 w-5" /> : String(index + 1).padStart(2, '0')}</span><Avatar user={user} size="h-10 w-10" /><div className="min-w-0 flex-1"><Link to={`/profile/${user.id}`} className="font-bold text-white hover:text-rose-300">{t(user.name)}</Link><p className="truncate text-xs text-zinc-500">{user.handle}</p></div><span className="font-mono text-sm font-bold text-amber-300 sm:text-base">{user.totalScore.toLocaleString(locale)}</span>{user.id !== 'you' && <button className="hidden rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 sm:block" onClick={() => onFollow(user.id)}>{following.includes(user.id) ? t("Following") : t("Follow")}</button>}</div>)}</div>
  </section>;
}

export function AuthScreen({ mode, onDemoAuth }: { mode: 'login' | 'register'; onDemoAuth: () => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { signIn, signUp, isConfigured } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const isRegister = mode === 'register';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setSuccessInfo(null);
    setSubmitting(true);

    try {
      if (isRegister) {
        const res = await signUp(email, password, displayName);
        if (res.error) {
          setAuthError(res.error.message);
        } else if (res.needsEmailConfirmation) {
          setSuccessInfo('Account created! Please check your email inbox to verify your account.');
        } else {
          onDemoAuth();
          navigate('/profile/you');
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setAuthError(res.error.message);
        } else {
          onDemoAuth();
          navigate('/profile/you');
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"><div className={card}>
    <div className="mb-4 flex items-center justify-between">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isConfigured ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
        {isConfigured ? t("Supabase Cloud Auth Active") : t("Offline / demo mode")}
      </span>
    </div>
    <PageHeading eyebrow="Virtual Drum" title={isRegister ? t("Create an account") : t("Welcome back")} description={isRegister ? t("Save performances, share results, and connect with friends.") : t("Log in to continue your rhythm journey.")} />

    {authError && (
      <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
        {authError}
      </div>
    )}

    {successInfo && (
      <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {successInfo}
      </div>
    )}

    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && <label className="block text-sm font-medium text-zinc-300">{t("Display name")}<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("Your name")} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-rose-400" /></label>}
      <label className="block text-sm font-medium text-zinc-300">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-rose-400" /></label>
      <label className="block text-sm font-medium text-zinc-300">{t("Password")}<div className="relative mt-1.5"><input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("At least 6 characters")} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-12 text-white outline-none focus:border-rose-400" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t("Hide password") : t("Show password")} className="absolute right-3 top-3 text-zinc-400"><Eye className="h-5 w-5" /></button></div></label>
      <button disabled={submitting} className={`${primary} w-full`}>
        {submitting ? (isRegister ? t("Creating...") : t("Logging in...")) : (isRegister ? t("Create an account") : t("Welcome back"))} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-4">
      <button type="button" onClick={() => { onDemoAuth(); navigate('/profile/you'); }} className="text-xs text-zinc-400 hover:text-zinc-200">
        {isRegister ? t("Create demo account") : t("Enter demo account")}
      </button>
      <p className="text-right text-xs text-zinc-500">
        {isConfigured ? t("Cloud sync ready") : t("Demo interface · no information is sent to a server")}
      </p>
    </div>
    <p className="mt-5 text-center text-sm text-zinc-400">{isRegister ? t("Already have an account?") : t("Don't have an account?")} <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-rose-300 hover:underline">{isRegister ? t("Log in") : t("Register")}</Link></p>
  </div></div>;
}

export function ProfileScreen({ clips, following, onFollow, onShareImage, comments, onAddComment, onRemoveComment }: CommentActions & { clips: ReplayClip[]; following: string[]; onFollow: (id: string) => void; onShareImage: (id: string) => void }) {
  const challenges = useChallenges();
  const { t, locale, clipTitle, clipDate } = useLanguage();
  const { userId = 'you' } = useParams();
  const navigate = useNavigate();
  const { profile, user: authUser, signOut } = useAuth();
  const user = USERS.find((entry) => entry.id === userId);
  if (!user) return <Missing />;
  const isOwn = user.id === 'you';
  const displayName = isOwn && profile?.displayName ? profile.displayName : user.name;
  const displayHandle = isOwn && profile?.email ? profile.email : user.handle;
  const userClips = clips.filter((clip) => clip.userId === user.id && (isOwn || clip.shared));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"><div className={`${card} relative overflow-hidden`}><div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-rose-500/25 via-amber-500/10 to-transparent" /><div className="relative flex flex-wrap items-end justify-between gap-5 pt-10"><div className="flex items-end gap-4"><Avatar user={{ ...user, name: displayName, initials: displayName.slice(0, 2).toUpperCase() }} size="h-20 w-20 text-2xl" /><div><h1 className="text-3xl font-black text-white">{t(displayName)}</h1><p className="text-sm text-zinc-400">{displayHandle}</p></div></div><div className="flex flex-wrap items-center gap-2">{isOwn ? <>
    <Link to="/notifications" className={secondary}><Bell className="h-4 w-4" /> {t("Notifications")}</Link>
    {(profile || authUser) && <button type="button" onClick={handleSignOut} className={secondary}><LogOut className="h-4 w-4" /> {t("Sign out")}</button>}
  </> : <>
    <button onClick={() => onFollow(user.id)} className={following.includes(user.id) ? secondary : primary}>{following.includes(user.id) ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{following.includes(user.id) ? t("Following") : t("Follow")}</button>
    <Link to={'/messages/' + user.id} className={secondary}><MessageCircle className="h-4 w-4" />{t('Message')}</Link>
  </>}</div></div><p className="mt-5 max-w-2xl text-sm text-zinc-300">{t(user.bio)}</p><div className="mt-6 flex flex-wrap gap-8 border-t border-zinc-800 pt-5 text-sm"><div><strong className="block text-xl text-white">{user.totalScore.toLocaleString(locale)}</strong><span className="text-zinc-500">{t("Total score")}</span></div><div><strong className="block text-xl text-white">{userClips.length}</strong><span className="text-zinc-500">{t("Clips")}</span></div><div><strong className="block text-xl text-white">{user.followers.toLocaleString(locale)}</strong><span className="text-zinc-500">{t("Followers")}</span></div></div></div><div className="mt-9 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">{t("Challenge clips")}</h2><p className="text-sm text-zinc-400">{t("Replay your performances and shared highlights")}</p></div>{isOwn && <Link to="/challenges" className={secondary}><Plus className="h-4 w-4" /> {t("Play more")}</Link>}</div><div className="mt-4 grid gap-4 md:grid-cols-2">{userClips.map((clip) => <div key={clip.id} className={card}><div className="mb-4 flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><Trophy className="h-6 w-6" /></div><span className="rounded-lg bg-amber-500/15 px-3 py-1 font-black text-amber-300">{clip.rank}</span></div><h3 className="text-lg font-bold text-white">{clip.shared ? <Link to={postPath(clip.id)} className="hover:text-rose-300">{clipTitle(clip)}</Link> : clipTitle(clip)}</h3><p className="mt-1 text-sm text-zinc-400">{clip.roomMode && <>{clip.roomName} · {t(clip.roomMode === 'versus' ? 'Challenge match' : 'Play together')} · </>}{t(challenges.find((challenge) => challenge.id === clip.challengeId)?.title ?? 'Challenge')} · {clipDate(clip.date)}</p><div className="mt-4 flex gap-5 text-sm"><span className="text-amber-300">{clip.score.toLocaleString(locale)} {t("points")}</span><span className="text-emerald-400">{clip.accuracy}{t("% accuracy")}</span></div><div className="mt-5 flex flex-wrap gap-2"><Link className={primary} to={`/replay/${clip.id}`}><Play className="h-4 w-4" /> {t("Replay")}</Link>{clip.shared ? <button type="button" className={secondary} onClick={() => onShareImage(clip.id)}><Share2 className="h-4 w-4" /> {t('Share post')}</button> : isOwn ? <Link className={secondary} to={`/share/${clip.id}`}><Share2 className="h-4 w-4" /> {t("Share to profile")}</Link> : null}</div>{clip.shared && <PostComments clipId={clip.id} comments={comments} onAddComment={onAddComment} onRemoveComment={onRemoveComment} />}</div>)}{userClips.length === 0 && <div className={`${card} md:col-span-2`}><p className="text-zinc-400">{t("No clips yet. Complete a challenge to get started.")}</p></div>}</div></div>;
}

export function ReplayScreen({ clips, onShareImage }: { clips: ReplayClip[]; onShareImage: (id: string) => void }) {
  const challenges = useChallenges();
  const { t, locale, clipTitle, clipDate } = useLanguage();
  const { clipId } = useParams();
  const clip = clips.find((entry) => entry.id === clipId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setIndex(0); setPlaying(false); }, [clipId]);
  useEffect(() => { if (!playing || !clip) return; if (index >= clip.events.length) { setPlaying(false); return; } const current = clip.events[index]; const previous = clip.events[index - 1]; const delay = Math.max(0, current.timeMs - (previous?.timeMs ?? current.timeMs)); const timer = window.setTimeout(() => { audioEngine.playDrum(current.drum); setIndex(index + 1); }, delay); return () => clearTimeout(timer); }, [playing, index, clip]);
  if (!clip) return <Missing />;
  const user = USERS.find((entry) => entry.id === clip.userId)!;
  const event = clip.events[Math.max(0, index - 1)];
  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"><Link to={`/profile/${clip.userId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> {t("Back to profile")}</Link><PageHeading eyebrow={t("Challenge replay")} title={clipTitle(clip)} description={`${t(user.name)} · ${t(challenges.find((challenge) => challenge.id === clip.challengeId)?.title ?? 'Challenge')} · ${clipDate(clip.date)}`} /><div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><div className={card}><div className="relative flex min-h-72 flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.15),transparent_60%)] p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-300"><Radio className="h-4 w-4" /> {t("Drum performance replay")}</div><div className="grid grid-cols-5 gap-2">{['hihat','tom','crash','snare','kick'].map((drum) => <div key={drum} className={`flex aspect-square items-center justify-center rounded-xl border text-[10px] font-bold uppercase sm:text-sm ${event?.drum === drum && index > 0 ? 'scale-105 border-rose-400 bg-rose-500/30 text-white shadow-lg shadow-rose-500/30' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>{t(drum === 'hihat' ? 'Hi-Hat' : drum[0].toUpperCase() + drum.slice(1))}</div>)}</div><div className="text-center text-sm text-zinc-400">{index > 0 ? `${t(event.drum === 'hihat' ? 'Hi-Hat' : event.drum[0].toUpperCase() + event.drum.slice(1)).toUpperCase()} · ${event.rating === 'miss' ? t("Miss") : t("Perfect")}` : t("Press play to hear each beat again")}</div></div><div className="mt-5 flex items-center gap-4"><button onClick={() => { if (index >= clip.events.length) setIndex(0); setPlaying(!playing); }} className={primary}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? t("Pause") : t("Play replay")}</button><input aria-label={t("Replay progress")} type="range" min={0} max={clip.events.length} value={index} onChange={(event) => { setIndex(Number(event.target.value)); setPlaying(false); }} className="w-full accent-rose-500" /><span className="whitespace-nowrap text-xs text-zinc-400">{index}/{clip.events.length}</span></div><p className="mt-3 text-xs text-zinc-500">{clip.id.startsWith('demo-') ? t("Demo replay data from a sample challenge.") : t("Replay the hits recorded in this browser session.")}</p></div><div className={card}><h2 className="text-lg font-bold text-white">{t("Performance results")}</h2><div className="mt-5 grid grid-cols-2 gap-4">{[[t("Score"), clip.score.toLocaleString(locale)], [t("Accuracy"), `${clip.accuracy}%`], [t("Rank"), clip.rank], [t("Hits"), String(clip.events.length)]].map(([label, value]) => <div key={label} className="rounded-xl bg-zinc-950 p-4"><p className="text-xs text-zinc-500">{label}</p><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}</div>{clip.shared ? <button type="button" onClick={() => onShareImage(clip.id)} className={`${secondary} mt-6 w-full`}><Share2 className="h-4 w-4" /> {t("Share image")}</button> : clip.userId === 'you' ? <Link to={`/share/${clip.id}`} className={`${secondary} mt-6 w-full`}><Share2 className="h-4 w-4" /> {t("Share to profile")}</Link> : null}</div></div></div>;
}

export function ShareScreen({ clips, latestResult, onPublish }: { clips: ReplayClip[]; latestResult: GameResult | null; onPublish: (clip: ReplayClip) => void }) {
  const challenges = useChallenges();
  const { t, locale, clipTitle } = useLanguage();
  const { clipId } = useParams();
  const navigate = useNavigate();
  const existing = clips.find((clip) => clip.id === clipId);
  const challenge = latestResult?.challenge;
  const [draftTitle, setTitle] = useState<string | null>(null);
  const title = draftTitle ?? (existing ? clipTitle(existing) : challenge ? t('I just played {title}!', { title: t(challenge.title) }) : '');
  useEffect(() => setTitle(null), [clipId]);
  if ((existing && existing.userId !== 'you') || (!existing && (!latestResult || clipId !== 'new'))) return <Missing />;
  const score = existing?.score ?? latestResult!.score;
  const accuracy = existing?.accuracy ?? latestResult!.accuracy;
  const rank = existing?.rank ?? latestResult!.rank;
  const challengeId = existing?.challengeId ?? challenge!.id;
  return <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><PageHeading eyebrow={t("Share results")} title={t("Let everyone hear your rhythm")} description={t("Create a demo post from your challenge result and view it on your profile.")} /><div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]"><div className={card}><label className="text-sm font-semibold text-zinc-200">{t("Clip title")}<input maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-rose-400" /></label><p className="mt-2 text-xs text-zinc-500">{t("Your shared clip will appear on your demo profile.")}</p><div className="mt-6 flex flex-wrap gap-3"><button className={primary} onClick={() => { if (existing) { onPublish({ ...existing, title: title.trim() || clipTitle(existing), generatedTitle: false, shared: true }); navigate('/profile/you'); } else if (latestResult) { onPublish({ id: `local-${Date.now()}`, userId: 'you', title: title.trim() || t('Performance: {title}', { title: t(challenge!.title) }), challengeId, score, accuracy, rank, date: new Date().toISOString(), shared: true, events: latestResult.replayEvents ?? [] }); navigate('/profile/you'); } }}><Share2 className="h-4 w-4" /> {existing ? t("Update post") : t("Post to demo profile")}</button></div></div><div className={card}><p className="text-xs font-bold uppercase tracking-widest text-rose-300">{t("Preview")}</p><h2 className="mt-4 text-xl font-bold text-white">{title || t("Clip title")}</h2><p className="mt-2 text-sm text-zinc-400">{existing?.roomMode ? <>{existing.roomName} · {t(existing.roomMode === 'versus' ? 'Challenge match' : 'Play together')} · </> : null}{t(challenges.find((entry) => entry.id === challengeId)?.title ?? 'Challenge')}</p><div className="mt-6 flex gap-3"><strong className="text-2xl text-amber-300">{score.toLocaleString(locale)}</strong><span className="self-end pb-1 text-sm text-zinc-500">{t("points ·")} {accuracy}{t("% · rank")} {rank}</span></div></div></div></div>;
}

export function NotificationsScreen({ following, clips }: { following: string[]; clips: ReplayClip[] }) {
  const { t, clipTitle, clipDate } = useLanguage();
  const news = clips.filter((clip) => clip.shared && following.includes(clip.userId));
  return <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><PageHeading eyebrow={t("Community")} title={t("Notifications")} description={t("Clips shared by players you follow. Demo notifications update immediately in the interface.")} /><div className="space-y-3">{news.map((clip) => { const user = USERS.find((entry) => entry.id === clip.userId)!; return <Link key={clip.id} to={postPath(clip.id)} className={`${card} flex items-center gap-4 transition-colors hover:border-rose-500/40`}><Avatar user={user} /><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200"><strong>{t(user.name)}</strong> {t("shared a new clip")}</p><p className="mt-1 truncate text-sm text-zinc-400">{clipTitle(clip)} · {clipDate(clip.date)}</p></div><ArrowRight className="h-4 w-4 text-zinc-500" /></Link>; })}{news.length === 0 && <div className={card}><Bell className="mb-3 h-8 w-8 text-zinc-500" /><h2 className="font-bold text-white">{t("No new notifications")}</h2><p className="mt-1 text-sm text-zinc-400">{t("Follow players on the leaderboard to see their shared clips.")}</p><Link to="/#leaderboard" className={`${secondary} mt-5`}>{t("Explore the leaderboard")}</Link></div>}</div></div>;
}

export function RoomsScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const challenges = useChallenges();
  const [roomList, setRoomList] = useState<RoomData[]>([]);
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedChallengeId, setSelectedChallengeId] = useState('beginner-beat');
  const [selectedMode, setSelectedMode] = useState<'versus' | 'together'>('versus');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchRooms().then((rooms) => {
      if (active) {
        setRoomList(rooms);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomName.trim()) return;
    const challenge = challenges.find((c) => c.id === selectedChallengeId);
    const room = await createRoom({
      name: roomName.trim(),
      hostName: profile?.displayName || 'You',
      hostId: profile?.id || 'you',
      challengeId: selectedChallengeId,
      challengeTitle: challenge?.title || 'Beginner Beat',
      mode: selectedMode,
    });
    navigate(`/rooms/${room.id}?name=${encodeURIComponent(room.name)}`);
  };

  const handleJoinByCode = (event: React.FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim();
    if (code) {
      navigate(`/rooms/${encodeURIComponent(code)}`);
    }
  };

  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <PageHeading eyebrow={t("Multiplayer")} title={t("Play together")} description={t("Choose a room to view its lobby or create your own demo room.")} />
    
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      {/* Create Room Form */}
      <div className={card}>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <Plus className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-white">{t("Create room")}</h2>
        </div>
        <form onSubmit={handleCreateRoom} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-300">
            {t("New room name")}
            <input required maxLength={32} value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={t("New room name")} aria-label={t("New room name")} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-rose-400" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300">{t("Song or challenge")}</label>
              <select value={selectedChallengeId} onChange={(e) => setSelectedChallengeId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-rose-400">
                {challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300">{t("Game mode")}</label>
              <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value as any)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-rose-400">
                <option value="versus">{t("Challenge match")}</option>
                <option value="together">{t("Play one song together")}</option>
              </select>
            </div>
          </div>
          <button className={`${primary} mt-2 w-full`}><Plus className="h-4 w-4" /> {t("Create room")}</button>
        </form>
      </div>

      {/* Join by Code */}
      <div className={card}>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-white">{t("Join by Room Code")}</h2>
        </div>
        <form onSubmit={handleJoinByCode} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-300">
            {t("Enter Room Code or Name")}
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. studio-night or room id" className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-rose-400" />
          </label>
          <button disabled={!joinCode.trim()} className={`${secondary} mt-2 w-full disabled:opacity-40`}>
            {t("Join")} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
          {t("Real-time multiplayer lobbies powered by Supabase Realtime Presence & Broadcast.")}
        </p>
      </div>
    </div>

    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        {roomList.length} {t("open rooms")}
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {roomList.map((room) => <div key={room.id} className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <Users className="h-6 w-6" />
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">{t(room.status)}</span>
        </div>
        <h2 className="mt-5 text-xl font-bold text-white">{t(room.name)}</h2>
        <p className="mt-1 text-sm text-zinc-400">{t("Host:")} {room.host}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-300">{t(room.challenge)}</span>
          <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-300">{room.players}/{room.capacity} {t("players")}</span>
        </div>
        <Link to={`/rooms/${room.id}`} className={`${secondary} mt-6 w-full`}>{t("Enter lobby")} <ArrowRight className="h-4 w-4" /></Link>
      </div>)}
    </div>
  </div>;
}

export function RoomScreen({ onStartGame }: { onStartGame: (challenge: RhythmChallenge, session: { roomName: string; mode: 'versus' | 'together'; roomId: string }) => void }) {
  const { t } = useLanguage();
  const { roomId = 'my-room' } = useParams();
  const [searchParams] = useSearchParams();
  const challenges = useChallenges();
  const { profile } = useAuth();

  const currentUserId = profile?.id || 'you';
  const currentUserName = profile?.displayName || 'You';
  const isOwn = roomId === 'my-room' || roomId.startsWith('room-');
  const fallbackRoom = ROOMS.find((entry) => entry.id === roomId);
  const roomNameParam = searchParams.get('name');
  const name = isOwn ? (roomNameParam || t("Your room")) : (fallbackRoom?.name || t("Room"));

  const [mode, setMode] = useState<'versus' | 'together'>('versus');
  const [challengeId, setChallengeId] = useState('beginner-beat');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const selectedChallenge = challenges.find((challenge) => challenge.id === challengeId) ?? challenges[0];

  const realtime = useRoomRealtime({
    roomId,
    roomName: name,
    user: { id: currentUserId, name: currentUserName },
    isInitialHost: isOwn,
    onGameStart: (challenge, session) => {
      onStartGame(challenge, session);
    },
    onRemoteSettingsChange: (update) => {
      if (update.challengeId) setChallengeId(update.challengeId);
      if (update.mode) setMode(update.mode);
    },
  });

  const isHost = realtime.isHost;
  const isJoined = realtime.isJoined;

  // Auto-join if own room
  useEffect(() => {
    if (isOwn && !isJoined) {
      realtime.joinRoom();
    }
  }, [isOwn, isJoined, realtime]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleModeChange = (newMode: 'versus' | 'together') => {
    setMode(newMode);
    realtime.broadcastRoomUpdate({ mode: newMode, challengeId });
  };

  const handleChallengeChange = (newChallengeId: string) => {
    setChallengeId(newChallengeId);
    realtime.broadcastRoomUpdate({ challengeId: newChallengeId, mode });
  };

  const handleStartGame = () => {
    if (!selectedChallenge) return;
    realtime.broadcastStartGame(selectedChallenge, mode);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    realtime.sendChatMessage(chatInput);
    setChatInput('');
  };

  // If no players are detected via presence, show standard/demo players
  const displayPlayers = realtime.players.length > 0
    ? realtime.players
    : (isOwn ? [{ id: 'you', name: currentUserName, isHost: true, ready: true, joinedAt: '' }] : [
        { id: 'host', name: fallbackRoom?.host || 'Host', isHost: true, ready: true, joinedAt: '' },
        ...(fallbackRoom?.players && fallbackRoom.players > 1 ? [{ id: 'linh', name: 'Linh Groove', isHost: false, ready: true, joinedAt: '' }] : []),
        ...(fallbackRoom?.players && fallbackRoom.players > 2 ? [{ id: 'khoa', name: 'Khoa Drum', isHost: false, ready: false, joinedAt: '' }] : []),
      ]);

  const canStart = isHost && Boolean(selectedChallenge);

  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {t("Room list")}
      </Link>
      <button onClick={handleCopyLink} className={`${secondary} text-xs py-1.5`}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? t("Link copied!") : t("Copy invite link")}
      </button>
    </div>

    <PageHeading eyebrow={t("Multiplayer lobby · demo")} title={isOwn ? name : t(name)} description={t("Pick a way to play. The host can start whenever the room is ready.")} />

    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      {/* Player List & Realtime Presence */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{t("Players in room")}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t("Room host can start at any time")}</p>
          </div>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm font-semibold text-zinc-300">
            {displayPlayers.length}/4
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {displayPlayers.map((player, index) => (
            <div key={`${player.id}-${index}`} className="flex items-center gap-3 rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 font-bold text-zinc-950">
                {player.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate text-sm">
                  {player.name} {player.id === currentUserId && `(${t("You")})`}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {player.isHost ? t("Host") : (player.ready ? t("Ready") : t("Not ready"))}
                </p>
              </div>
              {player.isHost ? (
                <Crown className="h-4 w-4 text-amber-400" />
              ) : (
                <span className={`h-2.5 w-2.5 rounded-full ${player.ready ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              )}
            </div>
          ))}

          {Array.from({ length: Math.max(0, 4 - displayPlayers.length) }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600">+</span>
              {t("Waiting for players...")}
            </div>
          ))}
        </div>

        {!isOwn && (
          <div className="mt-5 border-t border-zinc-800 pt-4 flex gap-2">
            <button
              onClick={() => (isJoined ? realtime.leaveRoom() : realtime.joinRoom())}
              className={`${isJoined ? secondary : primary} flex-1`}
            >
              {isJoined ? t("Leave lobby") : t("Join room")}
            </button>
            {isJoined && (
              <button
                onClick={() => {
                  const self = displayPlayers.find((p) => p.id === currentUserId);
                  realtime.toggleReady(!self?.ready);
                }}
                className={secondary}
              >
                {displayPlayers.find((p) => p.id === currentUserId)?.ready ? t("Not ready") : t("Ready")}
              </button>
            )}
          </div>
        )}

        {/* Room In-Lobby Chat */}
        <div className="mt-6 border-t border-zinc-800/80 pt-4">
          <p className="mb-2 text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-rose-400" /> {t("Room chat")}
          </p>
          <div className="h-28 overflow-y-auto space-y-1.5 rounded-xl bg-zinc-950/80 p-2.5 text-xs border border-zinc-800/60">
            {realtime.chatMessages.length === 0 ? (
              <p className="text-zinc-600 italic py-6 text-center">{t("Type a message...")}</p>
            ) : (
              realtime.chatMessages.map((m) => (
                <div key={m.id} className="text-zinc-300">
                  <span className="font-bold text-amber-300">{m.senderName}: </span>
                  <span>{m.text}</span>
                  <span className="ml-2 text-[10px] text-zinc-600">{m.time}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendChat} className="mt-2 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t("Type a message...")}
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white outline-none focus:border-rose-400"
            />
            <button type="submit" disabled={!chatInput.trim()} className={`${primary} px-3 py-1.5 text-xs disabled:opacity-40`}>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </section>

      {/* Match Settings & Mode */}
      <section className={card}>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-300">{t("Choose a game mode")}</p>
          <h2 className="mt-1 text-xl font-black text-white">{t("How do you want to play?")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === 'versus'}
            onClick={() => handleModeChange('versus')}
            className={`rounded-xl border p-4 text-left transition ${mode === 'versus' ? 'border-rose-400 bg-rose-500/10' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
              <Swords className="h-5 w-5" />
            </span>
            <strong className="mt-3 block text-sm text-white">{t("Challenge match")}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
              {t("Play the same challenge and compare your scores.")}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === 'together'}
            onClick={() => handleModeChange('together')}
            className={`rounded-xl border p-4 text-left transition ${mode === 'together' ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
              <Music className="h-5 w-5" />
            </span>
            <strong className="mt-3 block text-sm text-white">{t("Play one song together")}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
              {t("Enjoy one song together and share the session result.")}
            </span>
          </button>
        </div>

        <label className="mt-5 block text-sm font-semibold text-zinc-200">
          {t("Song or challenge")}
          <select
            value={challengeId}
            onChange={(event) => handleChallengeChange(event.target.value)}
            disabled={!isHost}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-rose-400 disabled:opacity-70"
          >
            {challenges.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.title} · {challenge.bpm} BPM
              </option>
            ))}
          </select>
        </label>

        {selectedChallenge && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-950 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
              <Drum className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selectedChallenge.title}</p>
              <p className="text-xs text-zinc-500">
                {selectedChallenge.music ? t("Song challenge") : t(selectedChallenge.difficulty)} · {selectedChallenge.durationSeconds}s
              </p>
            </div>
          </div>
        )}

        {canStart ? (
          <button
            type="button"
            onClick={handleStartGame}
            className={`${primary} mt-5 w-full`}
          >
            <Play className="h-4 w-4" />
            {t("Start room now")}
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {t(isHost ? "Join your room to start." : "Only the room host can start the game.")}
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          {t("Real-time multiplayer powered by Supabase. When the host starts, all connected players launch simultaneously!")}
        </p>
      </section>
    </div>
  </div>;
}

export function Missing() {
  const { t } = useLanguage();
  return <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
    <h1 className="text-3xl font-black text-white">{t("Page not found")}</h1>
    <p className="mt-2 text-zinc-400">{t("This URL is not available in the demo.")}</p>
    <Link to="/" className={`${primary} mt-6`}>{t("Exit to Home")}</Link>
  </div>;
}
