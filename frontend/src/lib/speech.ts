import { speechLang, type AppLocale } from "./locale";

type SpeechCtor = new () => SpeechRecognition;

export function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function listenWithLocale(
  locale: AppLocale,
  onText: (text: string, isFinal: boolean) => void,
  onError: (msg: string) => void,
  onState: (listening: boolean) => void,
): () => void {
  const Ctor = getSpeechRecognition();
  if (!Ctor) {
    onError("Chrome ya Edge browser use karein — mic ke liye.");
    return () => {};
  }

  const rec = new Ctor();
  rec.lang = speechLang(locale);
  rec.continuous = false;
  rec.interimResults = true;

  rec.onstart = () => onState(true);
  rec.onend = () => onState(false);
  rec.onerror = (e) => {
    onState(false);
    if (e.error === "not-allowed") onError("Mic ki permission allow karein.");
    else if (e.error !== "aborted") onError(`Mic error: ${e.error}`);
  };
  rec.onresult = (e) => {
    let final = "";
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0]?.transcript ?? "";
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (final) onText(final.trim(), true);
    else if (interim) onText(interim.trim(), false);
  };

  try {
    rec.start();
  } catch {
    onError("Mic start nahi ho paya — dubara try karein.");
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* noop */
    }
  };
}

/** @deprecated use listenWithLocale */
export const listenHindi = (
  onText: (text: string, isFinal: boolean) => void,
  onError: (msg: string) => void,
  onState: (listening: boolean) => void,
) => listenWithLocale("hi", onText, onError, onState);
