import type { ReplayClip } from '../data/community';
import { vietnamese } from './messages';

export type Language = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = 'virtual-drum-language';
export const languageLocale = (language: Language) => language === 'vi' ? 'vi-VN' : 'en-US';

// Also recognize built-in Vietnamese demo content saved by earlier versions.
const englishByVietnamese = Object.fromEntries(Object.entries(vietnamese).map(([english, translated]) => [translated, english]));

export function translate(text: string, language: Language, values: Record<string, string | number> = {}): string {
  const key = Object.hasOwn(vietnamese, text) ? text : (Object.hasOwn(englishByVietnamese, text) ? englishByVietnamese[text] : text);
  const message = language === 'vi' ? (Object.hasOwn(vietnamese, key) ? vietnamese[key] : key) : key;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

export function readLanguage(): Language {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'vi' ? 'vi' : 'en'; }
  catch { return 'en'; }
}

export function clipTitle(clip: ReplayClip, language: Language): string {
  if (clip.generatedTitle) return translate('Performance: {title}', language, { title: translate(clip.title, language) });
  return clip.id.startsWith('demo-') ? translate(clip.title, language) : clip.title;
}

export function clipDate(date: string, language: Language): string {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return translate(date, language);
  return new Intl.DateTimeFormat(languageLocale(language), { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}
