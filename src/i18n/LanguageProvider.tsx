import type { ReplayClip } from '../data/community';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clipTitle, clipDate, LANGUAGE_STORAGE_KEY, languageLocale, readLanguage, translate, type Language } from './translate';

type Translator = (text: string, values?: Record<string, string | number>) => string;
interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: Translator;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  const t = useCallback<Translator>((text, values) => translate(text, language, values), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Continue when browser storage is unavailable. */ }
  }, [language]);

  return <LanguageContext.Provider value={{ language, locale: languageLocale(language), setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return {
    ...context,
    clipTitle: (clip: ReplayClip) => clipTitle(clip, context.language),
    clipDate: (date: string) => clipDate(date, context.language),
  };
}
