"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { t, type MessageKey } from "./i18n";
import { loadLocale, saveLocale, type AppLocale } from "./locale";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  msg: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("hi");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(loadLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale === "en" ? "en" : locale;
  }, [locale, ready]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    saveLocale(next);
  }, []);

  const msg = useCallback((key: MessageKey) => t(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, msg }), [locale, setLocale, msg]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
      </div>
    );
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return ctx;
}
