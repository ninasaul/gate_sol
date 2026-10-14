import { en } from '@/messages/en';
import { zh } from '@/messages/zh';
import type { Messages } from '@/messages/types';

export type Locale = 'zh' | 'en';

export const LOCALE_STORAGE_KEY = 'gatesol-locale';

export const messagesByLocale: Record<Locale, Messages> = {
  zh,
  en,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh' || value === 'en';
}

export function resolveLocale(stored: string | null, language: string | null): Locale {
  if (isLocale(stored)) return stored;
  if (language && language.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

export function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const messages = messagesByLocale[locale];
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.setAttribute('data-locale', locale);
  document.title = messages.meta.title;
}

export function readDomLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  const value = document.documentElement.getAttribute('data-locale');
  return isLocale(value) ? value : null;
}
