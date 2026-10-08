import { useLanguage } from '@/i18n/LanguageProvider';
import React, { useEffect, useState } from 'react';
import { AppSettings } from '../types';
import { cameraTracker } from '../services/cameraTracker';
import { Sliders, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

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
  const { t } = useLanguage();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (isOpen) {
      cameraTracker.getAvailableCameras().then(setDevices);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        id="settings-modal-panel"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto max-w-md gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-rose-950/20 sm:max-w-md"
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-2.5 border-b border-zinc-800 p-6 pb-4 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <Sliders className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2.5">
            <div>
              <DialogTitle className="text-base font-bold text-white">{t("Settings")}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-zinc-400"> {t("Configure gameplay and tracking preferences")} </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Settings Form */}
        <div className="space-y-5 p-6">
          <div>
            <Label htmlFor="settings-language" className="mb-1.5 block text-xs font-semibold text-zinc-200">{t('Language')}</Label>
            <Select value={settings.language} onValueChange={(value) => { if (value === 'en' || value === 'vi') onUpdateSettings({ language: value }); }}>
              <SelectTrigger id="settings-language" className="w-full border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
                <SelectValue>{settings.language === 'vi' ? 'Tiếng Việt' : 'English'}</SelectValue>
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-zinc-500">{t('Choose your interface language')}</p>
          </div>
          {/* Camera On / Off Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="settings-camera" className="text-xs font-semibold text-zinc-200">{t("MediaPipe Hand Tracking")}</Label>
              <p className="text-[11px] text-zinc-500">{t("Move an index fingertip onto a visible drum")}</p>
            </div>
            <Switch
              id="settings-camera"
              checked={settings.cameraEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ cameraEnabled: checked })}
              className="data-checked:bg-rose-500 data-unchecked:bg-zinc-800"
            />
          </div>

          {/* Camera Device Dropdown */}
          {devices.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-zinc-200"> {t("Camera Device")} </Label>
              <Select
                value={settings.selectedCameraId || 'default'}
                onValueChange={(value) => onUpdateSettings({ selectedCameraId: value === 'default' ? '' : value ?? '' })}
              >
                <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
                  <SelectValue placeholder={t("Default Front / User Camera")} />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
                  <SelectItem value="default">{t("Default Front / User Camera")}</SelectItem>
                  {devices.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || t('Camera {number}', { number: i + 1 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Master Volume Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold text-zinc-200">{t("Master Volume")}</Label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[settings.volume]}
              onValueChange={(value) => onUpdateSettings({ volume: Array.isArray(value) ? value[0] : value })}
              className="w-full cursor-pointer [&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-zinc-800"
              aria-label={t("Master volume")}
            />
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="settings-sfx" className="text-xs font-semibold text-zinc-200">{t("Sound Effects & SFX")}</Label>
              <p className="text-[11px] text-zinc-500">{t("Play drum sounds and hit rating chimes")}</p>
            </div>
            <Switch
              id="settings-sfx"
              checked={settings.sfxEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ sfxEnabled: checked })}
              className="data-checked:bg-amber-500 data-unchecked:bg-zinc-800"
            />
          </div>

          {/* Visual Effects & Glow Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="settings-effects" className="text-xs font-semibold text-zinc-200">{t("Visual Effects & Glow")}</Label>
              <p className="text-[11px] text-zinc-500">{t("Display hit ripple waves and particle animations")}</p>
            </div>
            <Switch
              id="settings-effects"
              checked={settings.visualEffectsEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ visualEffectsEnabled: checked })}
              className="data-checked:bg-rose-500 data-unchecked:bg-zinc-800"
            />
          </div>

          {/* Mirror Camera Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="settings-mirror" className="text-xs font-semibold text-zinc-200">{t("Mirror Video Feed")}</Label>
              <p className="text-[11px] text-zinc-500">{t("Flip camera horizontally for natural mirror feel")}</p>
            </div>
            <Switch
              id="settings-mirror"
              checked={settings.mirrorCamera}
              onCheckedChange={(checked) => onUpdateSettings({ mirrorCamera: checked })}
              className="data-checked:bg-rose-500 data-unchecked:bg-zinc-800"
            />
          </div>
        </div>

        {/* Footer */}
        <Separator className="bg-zinc-800" />
        <DialogFooter className="m-0 border-0 bg-zinc-950 p-4">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <Check className="h-3.5 w-3.5" /> {t("Done")} </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
