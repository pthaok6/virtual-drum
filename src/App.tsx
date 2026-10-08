import { SongDetailScreen } from './screens/SongDetailScreen';
import { useSongLibrary } from './hooks/useSongLibrary';
import { ChallengeLibraryProvider } from './data/ChallengeLibrary';
import { useCommunity } from './hooks/useCommunity';
import { UserSearchScreen, MessagesScreen, PostScreen } from './screens/SocialScreens';
import { SongGameScreen } from './screens/SongGameScreen';
import { useLanguage } from '@/i18n/LanguageProvider';
import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ScreenType, RhythmChallenge, GameResult, AppSettings } from './types';
import { CHALLENGES } from './data/challenges';
import { DEMO_CLIPS, ReplayClip } from './data/community';
import { audioEngine } from './services/audio';
import { cameraTracker } from './services/cameraTracker';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { ShareImageDialog } from './components/ShareImageDialog';
import { HomeScreen } from './screens/HomeScreen';
import { FreePlayScreen } from './screens/FreePlayScreen';
import { ChallengeSelectScreen } from './screens/ChallengeSelectScreen';
import { RhythmGameScreen } from './screens/RhythmGameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { AuthScreen, Leaderboard, Missing, NotificationsScreen, ProfileScreen, ReplayScreen, RoomScreen, RoomsScreen, ShareScreen } from './screens/CommunityScreens';

const paths: Record<ScreenType, string> = {
  home: '/', 'free-play': '/free-play', 'challenge-select': '/challenges',
  'rhythm-game': '/challenge/play', result: '/challenge/result',
};

function readStored<T>(key: string, fallback: T): T {
  try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback; } catch { return fallback; }
}

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const songLibrary = useSongLibrary();
  const community = useCommunity();
  const commentActions = { comments: community.comments, onAddComment: community.addComment, onRemoveComment: community.removeComment };
  const unreadMessages = community.messages.filter(message => message.recipientId === 'you' && !message.read).length;
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedChallenge, setSelectedChallenge] = useState<RhythmChallenge>(CHALLENGES[0]);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [latestClipId, setLatestClipId] = useState<string | null>(null);
  const [shareImageClipId, setShareImageClipId] = useState<string | null>(null);
  const [createdClips, setCreatedClips] = useState<ReplayClip[]>(() => readStored('virtual-drum-clips', []));
  const [following, setFollowing] = useState<string[]>(() => readStored('virtual-drum-following', []));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gameplaySettings, setSettings] = useState<Omit<AppSettings, 'language'>>({ cameraEnabled: false, selectedCameraId: '', mirrorCamera: true, showHandIndicators: true, volume: 0.85, sfxEnabled: true, visualEffectsEnabled: true });
  const settings: AppSettings = { ...gameplaySettings, language };
  const clips = [...createdClips, ...DEMO_CLIPS.filter((demo) => !createdClips.some((clip) => clip.id === demo.id))];
  const imageClip = clips.find((clip) => clip.id === shareImageClipId) ?? null;
  const currentScreen: ScreenType = location.pathname === '/' ? 'home' : location.pathname === '/free-play' ? 'free-play' : location.pathname === '/challenges' ? 'challenge-select' : location.pathname === '/challenge/play' ? 'rhythm-game' : 'result';

  useEffect(() => cameraTracker.subscribeState((state) => setIsCameraActive(state.isStreaming)), []);
  useEffect(() => { audioEngine.setVolume(settings.volume); audioEngine.setMuted(!settings.sfxEnabled); }, [settings.volume, settings.sfxEnabled]);
  useEffect(() => { cameraTracker.setMirror(settings.mirrorCamera); }, [settings.mirrorCamera]);
  useEffect(() => { localStorage.setItem('virtual-drum-clips', JSON.stringify(createdClips)); }, [createdClips]);
  useEffect(() => { localStorage.setItem('virtual-drum-following', JSON.stringify(following)); }, [following]);
  useEffect(() => { if (location.hash) window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 0); else window.scrollTo(0, 0); }, [location.pathname, location.hash]);

  const handleUpdateSettings = ({ language: nextLanguage, ...partial }: Partial<AppSettings>) => {
    if (nextLanguage) setLanguage(nextLanguage);
    setSettings((previous) => ({ ...previous, ...partial }));
  };
  const handleNavigate = (screen: ScreenType) => navigate(paths[screen]);
  const handleFinishGame = (result: GameResult) => {
    const id = `local-${Date.now()}`;
    setGameResult(result);
    setLatestClipId(id);
    setCreatedClips((previous) => [{ id, userId: 'you', title: result.challenge.title, generatedTitle: true, challengeId: result.challenge.id, score: result.score, accuracy: result.accuracy, rank: result.rank, date: new Date().toISOString(), shared: false, events: result.replayEvents ?? [] }, ...previous]);
    navigate('/challenge/result');
  };
  const handleToggleCamera = async () => { if (isCameraActive) { cameraTracker.stop(); handleUpdateSettings({ cameraEnabled: false }); } else { const ok = await cameraTracker.start(undefined, settings.selectedCameraId); handleUpdateSettings({ cameraEnabled: ok }); } };
  const handleFollow = (id: string) => setFollowing((previous) => previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]);
  const handlePublish = (clip: ReplayClip) => setCreatedClips((previous) => [clip, ...previous.filter((entry) => entry.id !== clip.id)]);

  return <ChallengeLibraryProvider challenges={songLibrary.challenges}><div className="dark min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
    <Navbar currentScreen={currentScreen} onNavigate={handleNavigate} onOpenSettings={() => setIsSettingsOpen(true)} volume={settings.volume} onVolumeChange={(volume) => handleUpdateSettings({ volume })} isCameraActive={isCameraActive} unreadMessages={unreadMessages} />
    {community.storageError && <p role="alert" className="px-4 py-2 text-sm text-amber-300">{t(community.storageError)}</p>}
    <main className="flex-1 flex flex-col"><Routes>
      <Route path="/" element={<HomeScreen onNavigate={handleNavigate} onOpenSettings={() => setIsSettingsOpen(true)} isCameraActive={isCameraActive} onToggleCamera={handleToggleCamera} leaderboard={<Leaderboard following={following} onFollow={handleFollow} />} />} />
      <Route path="/free-play" element={<FreePlayScreen onNavigate={handleNavigate} settings={settings} onUpdateSettings={handleUpdateSettings} onOpenSettings={() => setIsSettingsOpen(true)} />} />
      <Route path="/challenges" element={<ChallengeSelectScreen onViewSong={(id) => navigate('/songs/' + encodeURIComponent(id))} onAddSong={songLibrary.addSong} storageMessage={songLibrary.storageMessage} onNavigate={handleNavigate} onSelectChallenge={setSelectedChallenge} />} />
      <Route path="/songs/:songId" element={<SongDetailScreen onSelectChallenge={setSelectedChallenge} onNavigate={handleNavigate} />} />
      <Route path="/challenge/play" element={selectedChallenge.music ? <SongGameScreen key={selectedChallenge.id} challenge={selectedChallenge} onFinishGame={handleFinishGame} onNavigate={handleNavigate} settings={settings} /> : <RhythmGameScreen key={selectedChallenge.id} challenge={selectedChallenge} onFinishGame={handleFinishGame} onNavigate={handleNavigate} settings={settings} />} />
      <Route path="/challenge/result" element={gameResult ? <ResultScreen result={gameResult} onPlayAgain={() => navigate('/challenge/play')} onChooseAnother={() => navigate('/challenges')} onBackToHome={() => navigate('/')} onShareImage={() => setShareImageClipId(latestClipId)} onShareProfile={() => navigate(`/share/${latestClipId}`)} /> : <Navigate to="/challenges" replace />} />
      <Route path="/login" element={<AuthScreen mode="login" onDemoAuth={() => navigate('/profile/you')} />} />
      <Route path="/register" element={<AuthScreen mode="register" onDemoAuth={() => navigate('/profile/you')} />} />
      <Route path="/profile/:userId" element={<ProfileScreen {...commentActions} clips={clips} following={following} onFollow={handleFollow} onShareImage={setShareImageClipId} />} />
      <Route path="/replay/:clipId" element={<ReplayScreen clips={clips} onShareImage={setShareImageClipId} />} />
      <Route path="/share/:clipId" element={<ShareScreen clips={clips} latestResult={gameResult} onPublish={handlePublish} />} />
      <Route path="/users" element={<UserSearchScreen following={following} onFollow={handleFollow} />} />
      <Route path="/messages" element={<MessagesScreen messages={community.messages} onSendMessage={community.sendMessage} onMarkRead={community.markRead} />} />
      <Route path="/messages/:userId" element={<MessagesScreen messages={community.messages} onSendMessage={community.sendMessage} onMarkRead={community.markRead} />} />
      <Route path="/posts/:clipId" element={<PostScreen {...commentActions} clips={clips} onShareImage={setShareImageClipId} />} />
      <Route path="/notifications" element={<NotificationsScreen clips={clips} following={following} />} />
      <Route path="/rooms" element={<RoomsScreen />} />
      <Route path="/rooms/:roomId" element={<RoomScreen />} />
      <Route path="*" element={<Missing />} />
    </Routes></main>
    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSettings={handleUpdateSettings} />
    <ShareImageDialog clip={imageClip} onClose={() => setShareImageClipId(null)} />
  </div></ChallengeLibraryProvider>;
}
