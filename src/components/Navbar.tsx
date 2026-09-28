import React from 'react';
import { ScreenType } from '../types';
import { Volume2, VolumeX, Settings, Camera, Music, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onOpenSettings: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  isCameraActive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  onOpenSettings,
  volume,
  onVolumeChange,
  isCameraActive,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Button
          id="nav-brand"
          type="button"
          variant="ghost"
          onClick={() => onNavigate('home')}
          className="group h-auto justify-start gap-3 p-0 transition-opacity hover:bg-transparent hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 p-2 shadow-lg shadow-rose-500/20">
            <Music className="h-5 w-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-lg sm:text-xl">
                Virtual Drum
              </span>
              <Badge variant="outline" className="h-5 border-rose-500/20 bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-400">
                PRO
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 -mt-0.5 hidden sm:block">
              Webcam Gesture Drum Machine
            </p>
          </div>
        </Button>

        {/* Center Nav Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            id="nav-link-home"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('home')}
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              currentScreen === 'home'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            Home
          </Button>
          <Button
            id="nav-link-free-play"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('free-play')}
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              currentScreen === 'free-play'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            Free Play
          </Button>
          <Button
            id="nav-link-challenge"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('challenge-select')}
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              currentScreen === 'challenge-select' || currentScreen === 'rhythm-game'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            Rhythm Challenge
          </Button>
        </nav>

        {/* Right Tools */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Camera Status Badge */}
          <Badge
            id="nav-camera-badge"
            variant="outline"
            className={`hidden md:flex items-center gap-2 rounded-full px-2.5 py-1 text-xs border ${
              isCameraActive
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            <Camera className="h-3.5 w-3.5" />
            <span>{isCameraActive ? 'Cam Active' : 'Cam Idle'}</span>
          </Badge>

          {/* Quick Volume Slider */}
          <div id="nav-volume-group" className="hidden lg:flex items-center gap-2 bg-zinc-900/90 rounded-lg px-2.5 py-1 border border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
              className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[volume]}
              onValueChange={(value) => onVolumeChange(Array.isArray(value) ? value[0] : value)}
              className="w-16 cursor-pointer [&_[data-slot=slider-range]]:bg-rose-500 [&_[data-slot=slider-track]]:bg-zinc-800"
              aria-label="Master volume"
            />
          </div>

          {/* Settings Button */}
          <Button
            id="nav-settings-btn"
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            title="Open Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
