export type AppLocale = "hi" | "en" | "ta" | "te" | "mr" | "bn";

export const LOCALE_OPTIONS: { code: AppLocale; label: string; native: string }[] = [
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "en", label: "English", native: "English" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
];

const KEY = "smriti_locale";

export function loadLocale(): AppLocale {
  if (typeof window === "undefined") return "hi";
  const v = localStorage.getItem(KEY);
  if (v && LOCALE_OPTIONS.some((o) => o.code === v)) return v as AppLocale;
  return "hi";
}

export function saveLocale(locale: AppLocale) {
  localStorage.setItem(KEY, locale);
}

export function speechLang(locale: AppLocale): string {
  const map: Record<AppLocale, string> = {
    hi: "hi-IN",
    en: "en-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
    bn: "bn-IN",
  };
  return map[locale];
}
