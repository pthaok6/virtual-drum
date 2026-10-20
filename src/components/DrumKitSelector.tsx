import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { audioEngine, DRUM_KITS, type DrumKitId } from '../services/audio';

export function DrumKitSelector({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [kit, setKit] = useState<DrumKitId>(() => audioEngine.getDrumKit());

  return <label className={'flex items-center gap-2 text-xs text-zinc-300 ' + (compact ? '' : 'rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2')}>
    <span className="whitespace-nowrap">{t('Drum kit')}</span>
    <select value={kit} onChange={event => {
      const next = event.target.value as DrumKitId;
      setKit(next);
      audioEngine.setDrumKit(next);
    }} aria-label={t('Drum kit')} className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-rose-400">
      {DRUM_KITS.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}
    </select>
  </label>;
}
