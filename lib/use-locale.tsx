'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyDocumentLocale,
  messagesByLocale,
  readDomLocale,
  readStoredLocale,
  resolveLocale,
  writeStoredLocale,
  type Locale,
} from '@/lib/locale';
import { translateReason as translateReasonText } from '@/lib/translate-reason';
import type { Messages } from '@/messages/types';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
  translateReason: (reason: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readDomLocale() ?? 'zh');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = resolveLocale(readStoredLocale(), navigator.language);
    setLocaleState(next);
    applyDocumentLocale(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyDocumentLocale(locale);
    writeStoredLocale(locale);
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const translateReason = useCallback(
    (reason: string) => translateReasonText(reason, locale),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages: messagesByLocale[locale],
      translateReason,
    }),
    [locale, setLocale, translateReason],
  );

  if (!ready) return null;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
