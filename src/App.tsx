import React, { useState, useEffect } from 'react';
import { ScreenType, RhythmChallenge, GameResult, AppSettings } from './types';
import { CHALLENGES } from './data/challenges';
import { audioEngine } from './services/audio';
import { cameraTracker } from './services/cameraTracker';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { HomeScreen } from './screens/HomeScreen';
import { FreePlayScreen } from './screens/FreePlayScreen';
import { ChallengeSelectScreen } from './screens/ChallengeSelectScreen';
import { RhythmGameScreen } from './screens/RhythmGameScreen';
import { ResultScreen } from './screens/ResultScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
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
  });

  // Keep camera tracker state in sync
  useEffect(() => {
    const unsub = cameraTracker.subscribeState((st) => {
      setIsCameraActive(st.isStreaming);
    });
    return () => unsub();
  }, []);

  // Synchronize audio engine volume
  useEffect(() => {
    audioEngine.setVolume(settings.volume);
    audioEngine.setMuted(!settings.sfxEnabled);
  }, [settings.volume, settings.sfxEnabled]);

  // Synchronize camera mirroring
  useEffect(() => {
    cameraTracker.setMirror(settings.mirrorCamera);
  }, [settings.mirrorCamera]);

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.volume !== undefined) {
        audioEngine.setVolume(partial.volume);
      }
      if (partial.sfxEnabled !== undefined) {
        audioEngine.setMuted(!partial.sfxEnabled);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
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

        {currentScreen === 'result' && gameResult && (
          <ResultScreen
            result={gameResult}
            onPlayAgain={() => setCurrentScreen('rhythm-game')}
            onChooseAnother={() => setCurrentScreen('challenge-select')}
            onBackToHome={() => setCurrentScreen('home')}
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
    </div>
  );
}
