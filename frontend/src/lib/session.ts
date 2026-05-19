import type { AppLocale } from "./locale";

export type PatientSession = {
  patientId: string;
  displayName: string;
  age?: number;
  gender?: string;
  location?: string;
  locale?: AppLocale;
};
const KEY = "smriti_patient_session";

export function loadSession(): PatientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PatientSession;
  } catch {
    return null;
  }
}

export function saveSession(session: PatientSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
