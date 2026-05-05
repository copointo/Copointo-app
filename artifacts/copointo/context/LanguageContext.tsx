import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Lang } from "@/i18n/translations";

const STORAGE_KEY = "copointo_lang_v1";

type Vars = Record<string, string | number>;

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Vars) => string;
  dir: "rtl" | "ltr";
  isAr: boolean;
  isEn: boolean;
  hydrated: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "ar" || stored === "en") setLangState(stored);
      } catch { /* ignore */ }
      finally { setHydrated(true); }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => { /* ignore */ });
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "ar" ? "en" : "ar";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => { /* ignore */ });
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars): string => {
      const dict = translations[lang];
      const template = dict[key] ?? translations.ar[key] ?? key;
      return format(template, vars);
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      toggle,
      t,
      dir: lang === "ar" ? "rtl" : "ltr",
      isAr: lang === "ar",
      isEn: lang === "en",
      hydrated,
    }),
    [lang, setLang, toggle, t, hydrated],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx;
}
