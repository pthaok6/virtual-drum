import React, { useState, useEffect } from 'react';
import { ScreenType, RhythmChallenge, GameResult, AppSettings } from './types';
import { CHALLENGES } from './data/challenges';
import { audioEngine } from './services/audio';
import { cameraTracker } from './services/cameraTracker';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { HomeScreen } from './screens/HomeScreen';
import { FreePlayScreen } from './screens/FreePlayScreen';
import { ChallengeSelectScreen } from './screens/ChallengeSelectScreen';
import { RhythmGameScreen } from './screens/RhythmGameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { RecordingsScreen } from './screens/RecordingsScreen';
import { RoomsLobbyScreen } from './screens/RoomsLobbyScreen';
import { LiveRoomScreen } from './screens/LiveRoomScreen';
import { parseSharedRecordingFromUrl } from './services/wavExporter';
import { recordingsStorage } from './services/recordingsStorage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<RhythmChallenge>(CHALLENGES[0]);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>({
    cameraEnabled: false,
    selectedCameraId: '',
    mirrorCamera: true,
    showHandIndicators: true,
    volume: 0.85,
    sfxEnabled: true,
    visualEffectsEnabled: true,
    drumKitPreset: 'acoustic',
    velocitySensitivity: 1.0,
  });

  // Keep camera tracker state in sync
  useEffect(() => {
    const unsub = cameraTracker.subscribeState((st) => {
      setIsCameraActive(st.isStreaming);
    });
    return () => unsub();
  }, []);

  // Synchronize audio engine volume and preset
  useEffect(() => {
    audioEngine.setVolume(settings.volume);
    audioEngine.setMuted(!settings.sfxEnabled);
    audioEngine.setPreset(settings.drumKitPreset);
  }, [settings.volume, settings.sfxEnabled, settings.drumKitPreset]);

  // Synchronize camera mirroring
  useEffect(() => {
    cameraTracker.setMirror(settings.mirrorCamera);
  }, [settings.mirrorCamera]);

  // Check if a shared drum track was provided via URL
  useEffect(() => {
    const shared = parseSharedRecordingFromUrl();
    if (shared) {
      recordingsStorage.importRecording(shared);
      setCurrentScreen('recordings');
    }
  }, []);

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.volume !== undefined) {
        audioEngine.setVolume(partial.volume);
      }
      if (partial.sfxEnabled !== undefined) {
        audioEngine.setMuted(!partial.sfxEnabled);
      }
      if (partial.drumKitPreset !== undefined) {
        audioEngine.setPreset(partial.drumKitPreset);
      }
      return next;
    });
  };

  const handleNavigate = (screen: ScreenType) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinishGame = (result: GameResult) => {
    setGameResult(result);
    setCurrentScreen('result');
  };

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      cameraTracker.stop();
      handleUpdateSettings({ cameraEnabled: false });
    } else {
      const ok = await cameraTracker.start(undefined, settings.selectedCameraId);
      handleUpdateSettings({ cameraEnabled: ok });
    }
  };

  const handleSelectChallengeToPlay = (challengeId: string) => {
    const matched = CHALLENGES.find((c) => c.id === challengeId);
    if (matched) {
      setSelectedChallenge(matched);
      handleNavigate('rhythm-game');
    }
  };

  return (
    <AuthProvider>
      <div className="dark min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
        {/* Top Navigation */}
        <Navbar
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          onOpenSettings={() => setIsSettingsOpen(true)}
          volume={settings.volume}
          onVolumeChange={(vol) => handleUpdateSettings({ volume: vol })}
          isCameraActive={isCameraActive}
        />

        {/* Main Screen Content */}
        <main className="flex-1 flex flex-col">
          {currentScreen === 'home' && (
            <HomeScreen
              onNavigate={handleNavigate}
              onOpenSettings={() => setIsSettingsOpen(true)}
              isCameraActive={isCameraActive}
              onToggleCamera={handleToggleCamera}
            />
          )}

          {currentScreen === 'free-play' && (
            <FreePlayScreen
              onNavigate={handleNavigate}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {currentScreen === 'challenge-select' && (
            <ChallengeSelectScreen
              onNavigate={handleNavigate}
              onSelectChallenge={(c) => {
                setSelectedChallenge(c);
              }}
            />
          )}

          {currentScreen === 'rhythm-game' && (
            <RhythmGameScreen
              challenge={selectedChallenge}
              onFinishGame={handleFinishGame}
              onNavigate={handleNavigate}
              settings={settings}
            />
          )}

          {currentScreen === 'leaderboard' && (
            <LeaderboardScreen
              onNavigate={handleNavigate}
              onSelectChallengeToPlay={handleSelectChallengeToPlay}
            />
          )}

          {currentScreen === 'recordings' && (
            <RecordingsScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === 'rooms' && (
            activeRoomId ? (
              <LiveRoomScreen
                roomId={activeRoomId}
                onLeaveRoom={() => {
                  setActiveRoomId(null);
                }}
              />
            ) : (
              <RoomsLobbyScreen
                onNavigate={handleNavigate}
                onJoinRoom={(roomId) => {
                  setActiveRoomId(roomId);
                }}
              />
            )
          )}

          {currentScreen === 'result' && gameResult && (
            <ResultScreen
              result={gameResult}
              onPlayAgain={() => setCurrentScreen('rhythm-game')}
              onChooseAnother={() => setCurrentScreen('challenge-select')}
              onBackToHome={() => setCurrentScreen('home')}
              onViewLeaderboard={() => setCurrentScreen('leaderboard')}
            />
          )}
        </main>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />

        {/* Authentication Modal */}
        <AuthModal />
      </div>
    </AuthProvider>
  );
}
