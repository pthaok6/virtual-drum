import React, { useEffect, useState } from 'react';
import { AppSettings } from '../types';
import { cameraTracker } from '../services/cameraTracker';
import { X, Camera, Volume2, Sparkles, Sliders, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (isOpen) {
      cameraTracker.getAvailableCameras().then(setDevices);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="settings-modal-panel"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-rose-950/20"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Audio & Camera Settings</h2>
              <p className="text-xs text-zinc-400">Configure gameplay and tracking preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Settings Form */}
        <div className="mt-5 space-y-5">
          {/* Camera On / Off Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-200">MediaPipe Hand Tracking</label>
              <p className="text-[11px] text-zinc-500">Move an index fingertip onto a visible drum</p>
            </div>
            <button
              onClick={() => onUpdateSettings({ cameraEnabled: !settings.cameraEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.cameraEnabled ? 'bg-rose-500' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.cameraEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Camera Device Dropdown */}
          {devices.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                Camera Device
              </label>
              <select
                value={settings.selectedCameraId}
                onChange={(e) => onUpdateSettings({ selectedCameraId: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
              >
                <option value="">Default Front / User Camera</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Master Volume Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-200">Master Volume</label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
              className="w-full h-2 accent-amber-500 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-200">Sound Effects & SFX</label>
              <p className="text-[11px] text-zinc-500">Play drum sounds and hit rating chimes</p>
            </div>
            <button
              onClick={() => onUpdateSettings({ sfxEnabled: !settings.sfxEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.sfxEnabled ? 'bg-amber-500' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.sfxEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Visual Effects & Glow Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-200">Visual Effects & Glow</label>
              <p className="text-[11px] text-zinc-500">Display hit ripple waves and particle animations</p>
            </div>
            <button
              onClick={() => onUpdateSettings({ visualEffectsEnabled: !settings.visualEffectsEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.visualEffectsEnabled ? 'bg-rose-500' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.visualEffectsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Mirror Camera Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-200">Mirror Video Feed</label>
              <p className="text-[11px] text-zinc-500">Flip camera horizontally for natural mirror feel</p>
            </div>
            <button
              onClick={() => onUpdateSettings({ mirrorCamera: !settings.mirrorCamera })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.mirrorCamera ? 'bg-rose-500' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.mirrorCamera ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
