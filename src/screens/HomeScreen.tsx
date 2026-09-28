import React from 'react';
import { ScreenType, DrumType } from '../types';
import { DRUMS } from '../data/drums';
import { DrumPad } from '../components/DrumPad';
import { audioEngine } from '../services/audio';
import { Play, Sparkles, Camera, Hand, Music, Award, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface HomeScreenProps {
  onNavigate: (screen: ScreenType) => void;
  onOpenSettings: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenSettings,
  isCameraActive,
  onToggleCamera,
}) => {
  const [activePreviewDrum, setActivePreviewDrum] = React.useState<DrumType | null>(null);

  const handlePreviewHit = (drum: DrumType) => {
    audioEngine.playDrum(drum);
    setActivePreviewDrum(drum);
    setTimeout(() => setActivePreviewDrum(null), 180);
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Hero Badge */}
      <Badge variant="outline" className="mb-6 h-auto gap-2 border-rose-500/20 bg-rose-500/10 px-3.5 py-1 text-xs font-semibold text-rose-400 backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Next-Gen Webcam Gesture Percussion</span>
      </Badge>

      {/* Main Title & Description */}
      <div className="text-center max-w-3xl mb-8">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white uppercase drop-shadow-sm">
          Virtual <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-rose-500">Drum</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
          Play drums right in your browser using natural hand gestures detected through your webcam.
          Move your index finger onto virtual drums to trigger studio-grade acoustic percussion with real-time feedback.
        </p>
      </div>

      {/* Two Prominent CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-12 w-full max-w-md justify-center">
        <Button
          id="hero-cta-free-play"
          size="lg"
          onClick={() => onNavigate('free-play')}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-7 py-4 text-base font-bold text-white shadow-xl shadow-rose-500/25 transition-all hover:scale-105 active:scale-95 hover:shadow-rose-500/40"
        >
          <Play className="h-5 w-5 fill-current" />
          <span>Free Play</span>
        </Button>

        <Button
          id="hero-cta-rhythm-challenge"
          size="lg"
          onClick={() => onNavigate('challenge-select')}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-7 py-4 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 hover:shadow-amber-500/40"
        >
          <Award className="h-5 w-5 stroke-[2.5]" />
          <span>Rhythm Challenge</span>
        </Button>
      </div>

      {/* Interactive Drum Kit Preview Card */}
      <Card className="mb-14 w-full gap-0 rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/60 to-zinc-950/90 py-0 text-zinc-100 shadow-2xl backdrop-blur-xl">
        <CardHeader className="flex flex-col items-start justify-between gap-3 border-b border-zinc-800/80 p-6 sm:flex-row sm:items-center sm:p-8 sm:pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Interactive Acoustic Kit Preview
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">
              5-Piece Studio Drum Architecture
            </h2>
          </div>
          <div className="text-xs text-zinc-400 flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span>Tap pads or use keys:</span>
            <span className="font-mono text-amber-400 font-bold">[H] [T] [C] [S] [K]</span>
          </div>
        </CardHeader>

        {/* Realistic Drum Arrangement */}
        <CardContent className="grid grid-cols-2 items-center justify-items-center gap-4 p-6 sm:grid-cols-3 sm:p-8 md:grid-cols-5">
          {DRUMS.map((drum) => (
            <div key={drum.id} className="flex flex-col items-center">
              <DrumPad
                drum={drum}
                isHit={activePreviewDrum === drum.id}
                onClick={() => handlePreviewHit(drum.id)}
                size="md"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* How it Works Section (3 steps: Camera -> Move Your Hands -> Play Drums) */}
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Intuitive Optical Interaction
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">
            How It Works in 3 Simple Steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <Card className="gap-0 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 py-0 text-zinc-100 transition-colors hover:border-zinc-700">
            <CardContent className="flex flex-col items-start p-6">
            <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <Camera className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] font-bold text-rose-400">
                1
              </span>
              <h3 className="text-base font-bold text-white">Enable Camera</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Allow standard webcam access. Your camera feed mirrors your motions on screen with zero video recorded or stored.
            </p>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="gap-0 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 py-0 text-zinc-100 transition-colors hover:border-zinc-700">
            <CardContent className="flex flex-col items-start p-6">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Hand className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-bold text-cyan-400">
                2
              </span>
              <h3 className="text-base font-bold text-white">Move Your Hands</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Reach toward any of the 5 visible drums. Hand tracking plays it as soon as your index finger enters.
            </p>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="gap-0 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 py-0 text-zinc-100 transition-colors hover:border-zinc-700">
            <CardContent className="flex flex-col items-start p-6">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Music className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">
                3
              </span>
              <h3 className="text-base font-bold text-white">Play Drums</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Hear instant synthesized drum acoustic responses with dynamic visual ripple glows, combo tracking, and rhythm challenges.
            </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
