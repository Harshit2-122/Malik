"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { api, formatApiError, type Insight, type Visit } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import type { AppLocale } from "@/lib/locale";
import { loadLocale } from "@/lib/locale";
import { extractMedicinesFromOcr, scanPrescriptionImage } from "@/lib/prescription-scan";
import { QUICK_SYMPTOMS } from "@/lib/quick-symptoms";
import { clearSession, loadSession, saveSession, type PatientSession } from "@/lib/session";
import { listenWithLocale } from "@/lib/speech";
import { LanguageSelector } from "./LanguageSelector";

type Screen = "home" | "dashboard" | "visit" | "insight" | "doctor";

function dateLocale(locale: AppLocale): string {
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

function formatVisitDate(iso: string, locale: AppLocale) {
  try {
    return new Date(iso).toLocaleDateString(dateLocale(locale), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SmritiApp() {
  const qc = useQueryClient();
  const { locale, setLocale, msg } = useLocale();
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<PatientSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Onboarding form
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");

  // Visit form
  const [symptoms, setSymptoms] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [medicines, setMedicines] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [visitSuccess, setVisitSuccess] = useState(false);
  const [scanningRx, setScanningRx] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanOk, setScanOk] = useState(false);
  const rxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLocale = loadLocale();
    setLocale(savedLocale);
    const s = loadSession();
    if (s) {
      const updated = { ...s, locale: savedLocale };
      setSession(updated);
      saveSession(updated);
      setScreen("dashboard");
    }
    setHydrated(true);
  }, [setLocale]);

  const onLocaleChange = (next: AppLocale) => {
    setLocale(next);
    if (session) {
      const updated = { ...session, locale: next };
      saveSession(updated);
      setSession(updated);
      qc.invalidateQueries({ queryKey: ["insight", patientId] });
    }
  };

  const patientId = session?.patientId;

  const visitsQuery = useQuery({
    queryKey: ["visits", patientId],
    queryFn: () => api.listVisits(patientId!),
    enabled: !!patientId && (screen === "dashboard" || screen === "doctor"),
  });

  const insightQuery = useQuery({
    queryKey: ["insight", patientId, locale],
    queryFn: () => api.insight(patientId!, locale),
    enabled: !!patientId && (screen === "dashboard" || screen === "insight" || screen === "doctor"),
  });

  const createPatient = useMutation({
    mutationFn: () =>
      api.createPatient({
        display_name: name.trim() || (locale === "en" ? "Unknown" : "अज्ञात"),
        age: age ? parseInt(age, 10) : undefined,
        locale,
      }),
    onSuccess: (p) => {
      const s: PatientSession = {
        patientId: p.id,
        displayName: p.display_name,
        age: p.age ?? undefined,
        gender: gender || undefined,
        location: location || undefined,
        locale,
      };
      saveSession(s);
      setSession(s);
      setScreen("dashboard");
    },
  });

  const addVisit = useMutation({
    mutationFn: () =>
      api.addVisit(patientId!, {
        symptoms_hindi: symptoms.trim(),
        doctor_name: doctorName.trim() || undefined,
        bp_sys: bpSys ? parseInt(bpSys, 10) : undefined,
        bp_dia: bpDia ? parseInt(bpDia, 10) : undefined,
        medicines: medicines.trim() || undefined,
      }),
    onSuccess: () => {
      setVisitSuccess(true);
      qc.invalidateQueries({ queryKey: ["visits", patientId] });
      qc.invalidateQueries({ queryKey: ["insight", patientId, locale] });
      setTimeout(() => {
        setVisitSuccess(false);
        setSymptoms("");
        setDoctorName("");
        setBpSys("");
        setBpDia("");
        setMedicines("");
        setScreen("dashboard");
      }, 1200);
    },
  });

  const startMic = useCallback(() => {
    setVoiceError(null);
    let base = symptoms.trim();
    listenWithLocale(
      locale,
      (text, isFinal) => {
        if (isFinal) {
          base = base ? `${base} ${text}` : text;
          setSymptoms(base);
        } else {
          setSymptoms(base ? `${base} ${text}` : text);
        }
      },
      setVoiceError,
      setListening,
    );
  }, [symptoms, locale]);

  const onPrescriptionPick = async (file: File | undefined) => {
    if (!file) return;
    setScanningRx(true);
    setScanMsg(null);
    setScanOk(false);
    try {
      const text = await scanPrescriptionImage(file, locale, setScanProgress);
      if (!text) {
        setScanMsg(msg("scanPrescriptionEmpty"));
        return;
      }
      const meds = extractMedicinesFromOcr(text);
      if (meds) setMedicines((m) => (m.trim() ? `${m.trim()}, ${meds}` : meds));
      if (!symptoms.trim()) setSymptoms(text.slice(0, 400));
      setScanMsg(msg("scanPrescriptionSuccess"));
      setScanOk(true);
    } catch {
      setScanMsg(msg("scanPrescriptionError"));
      setScanOk(false);
    } finally {
      setScanningRx(false);
      setScanProgress(0);
    }
  };

  const logout = () => {
    clearSession();
    setSession(null);
    setScreen("home");
    setName("");
    setAge("");
    setGender("");
    setLocation("");
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
      </div>
    );
  }

  const quickSymptoms = QUICK_SYMPTOMS[locale];

  return (
    <div key={locale} className="min-h-dvh bg-paper">
      <div className="mx-auto min-h-dvh max-w-lg">
        {/* ── HOME / ONBOARDING ── */}
        {screen === "home" && (
          <div className="flex min-h-dvh flex-col px-5 pb-10 pt-8 safe-bottom">
            <div className="flex items-start justify-between gap-3">
              <BrandLogo />
              <div className="w-40 shrink-0 pt-1">
                <LanguageSelector value={locale} onChange={onLocaleChange} label={msg("language")} />
              </div>
            </div>
            <div className="mt-10 flex-1">
              <span className="inline-block rounded-full bg-terracotta-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terracotta">
                {msg("badge")}
              </span>
              <h1 className="mt-5 font-display text-4xl leading-[1.15] text-ink text-balance">
                {msg("hero1")}
                <br />
                <span className="text-terracotta">{msg("hero2")}</span>
              </h1>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">{msg("heroDesc")}</p>
              <p className="mt-6 flex items-center gap-2 text-sm text-ink-faint">
                <span className="flex -space-x-1">
                  {["🌾", "🏙️", "👨‍⚕️"].map((e) => (
                    <span key={e} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs shadow-sm">
                      {e}
                    </span>
                  ))}
                </span>
                {msg("trusted")}
              </p>
            </div>

            <Card className="mt-8">
              <h2 className="text-lg font-semibold text-ink">{msg("formTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{msg("formDesc")}</p>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createPatient.mutate();
                }}
              >
                <Field label={msg("name")} required>
                  <input
                    className="field-input"
                    placeholder={msg("namePh")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={msg("age")}>
                    <input
                      className="field-input"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="45"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </Field>
                  <Field label={msg("gender")}>
                    <select
                      className="field-input"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">{msg("genderPick")}</option>
                      <option value="male">{msg("male")}</option>
                      <option value="female">{msg("female")}</option>
                      <option value="other">{msg("other")}</option>
                    </select>
                  </Field>
                </div>
                <Field label={msg("location")}>
                  <input
                    className="field-input"
                    placeholder={msg("locationPh")}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </Field>
                {createPatient.isError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formatApiError(createPatient.error, msg("errBackend"), msg("errNetwork"))}
                  </p>
                )}
                <Button type="submit" full disabled={createPatient.isPending}>
                  {createPatient.isPending ? msg("submitting") : msg("submit")}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {screen === "dashboard" && session && (
          <div className="px-5 pb-28 pt-6 safe-bottom">
            <header className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-faint">{msg("greeting")}</p>
                <h1 className="font-display text-3xl text-ink">{session.displayName}</h1>
                {session.location && (
                  <p className="mt-0.5 text-sm text-ink-muted">📍 {session.location}</p>
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl px-2 py-1 text-xs text-ink-faint hover:bg-terracotta-muted/50"
              >
                {msg("logout")}
              </button>
            </header>

            <Card className="mt-6 bg-gradient-to-br from-terracotta to-terracotta-light !border-0 !text-white">
              <p className="text-sm font-medium text-white/80">{msg("insightTitle")}</p>
              <p className="mt-2 text-base leading-snug">
                {insightQuery.data?.summary_hi?.slice(0, 120) ?? msg("insightPreviewEmpty")}
                {(insightQuery.data?.summary_hi?.length ?? 0) > 120 ? "…" : ""}
              </p>
              <button
                type="button"
                onClick={() => setScreen("insight")}
                className="mt-4 text-sm font-semibold underline underline-offset-2"
              >
                {msg("insightMore")}
              </button>
            </Card>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <ActionTile
                icon="➕"
                label={msg("newVisit")}
                desc={msg("newVisitDesc")}
                onClick={() => setScreen("visit")}
              />
              <ActionTile
                icon="🩺"
                label={msg("doctorView")}
                desc={msg("doctorViewDesc")}
                onClick={() => setScreen("doctor")}
              />
            </div>

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {msg("recentVisits")}
              </h2>
              {visitsQuery.isLoading && (
                <p className="mt-3 text-sm text-ink-muted">{msg("loading")}</p>
              )}
              {visitsQuery.data?.length === 0 && (
                <Card className="mt-3 text-center text-sm text-ink-muted">{msg("noVisits")}</Card>
              )}
              <ul className="mt-3 space-y-3">
                {(visitsQuery.data ?? []).slice().reverse().slice(0, 5).map((v) => (
                  <VisitRow key={v.id} visit={v} locale={locale} />
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* ── NEW VISIT ── */}
        {screen === "visit" && session && (
          <div className="px-5 pb-10 pt-6 safe-bottom">
            <BackHeader title={msg("visitTitle")} onBack={() => setScreen("dashboard")} />
            {visitSuccess ? (
              <Card className="mt-10 text-center">
                <p className="text-4xl">✓</p>
                <p className="mt-3 font-semibold text-terracotta">{msg("visitSaved")}</p>
                <p className="mt-1 text-sm text-ink-muted">{msg("visitSavedSub")}</p>
              </Card>
            ) : (
              <form
                className="mt-6 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!symptoms.trim()) return;
                  addVisit.mutate();
                }}
              >
                <Card>
                  <label className="text-sm font-semibold text-ink">{msg("symptoms")}</label>
                  <p className="text-xs text-ink-faint">{msg("symptomsHint")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quickSymptoms.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="rounded-full border border-[var(--border)] bg-cream px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-terracotta hover:text-terracotta"
                        onClick={() =>
                          setSymptoms((prev) => (prev.includes(s) ? prev : prev ? `${prev}, ${s}` : s))
                        }
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="field-input mt-3 min-h-[120px] resize-none"
                    placeholder={msg("symptomsPh")}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    full
                    className="mt-3"
                    disabled={listening}
                    onClick={startMic}
                  >
                    {listening ? `🎙 ${msg("micListening")}` : `🎙 ${msg("mic")}`}
                  </Button>
                  {voiceError && <p className="mt-2 text-sm text-amber-700">{voiceError}</p>}
                </Card>

                <Card className="space-y-4">
                  <Field label={msg("doctorOptional")}>
                    <input
                      className="field-input"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="Dr. Sharma"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={msg("bpSys")}>
                      <input
                        className="field-input"
                        type="number"
                        value={bpSys}
                        onChange={(e) => setBpSys(e.target.value)}
                        placeholder="120"
                      />
                    </Field>
                    <Field label={msg("bpDia")}>
                      <input
                        className="field-input"
                        type="number"
                        value={bpDia}
                        onChange={(e) => setBpDia(e.target.value)}
                        placeholder="80"
                      />
                    </Field>
                  </div>
                  <Field label={msg("medicines")}>
                    <input
                      className="field-input"
                      value={medicines}
                      onChange={(e) => setMedicines(e.target.value)}
                      placeholder="Metformin 500mg"
                    />
                  </Field>
                  <input
                    ref={rxInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void onPrescriptionPick(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    full
                    disabled={scanningRx}
                    onClick={() => rxInputRef.current?.click()}
                  >
                    {scanningRx
                      ? `${msg("scanPrescriptionScanning")} ${scanProgress}%`
                      : `📷 ${msg("scanPrescription")}`}
                  </Button>
                  <p className="text-xs text-ink-faint">{msg("scanPrescriptionHint")}</p>
                  {scanMsg && (
                    <p className={`text-sm ${scanOk ? "text-emerald-700" : "text-amber-700"}`}>{scanMsg}</p>
                  )}
                </Card>

                {addVisit.isError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formatApiError(addVisit.error, msg("errBackend"), msg("errNetwork"))}
                  </p>
                )}
                <Button type="submit" full disabled={addVisit.isPending || !symptoms.trim()}>
                  {addVisit.isPending ? msg("saving") : msg("saveVisit")}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* ── INSIGHT ── */}
        {screen === "insight" && session && (
          <InsightScreen
            insight={insightQuery.data}
            loading={insightQuery.isLoading}
            onBack={() => setScreen("dashboard")}
          />
        )}

        {/* ── DOCTOR VIEW ── */}
        {screen === "doctor" && session && (
          <DoctorScreen
            session={session}
            visits={visitsQuery.data ?? []}
            insight={insightQuery.data}
            loading={visitsQuery.isLoading || insightQuery.isLoading}
            onBack={() => setScreen("dashboard")}
          />
        )}

        {/* Bottom nav */}
        {session && screen !== "home" && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-white/95 backdrop-blur-md safe-bottom">
            <div className="mx-auto flex max-w-lg justify-around px-4 py-3">
              <NavBtn active={screen === "dashboard"} label={msg("navHome")} onClick={() => setScreen("dashboard")} />
              <NavBtn active={screen === "visit"} label={msg("navVisit")} onClick={() => setScreen("visit")} />
              <NavBtn active={screen === "insight"} label={msg("navInsight")} onClick={() => setScreen("insight")} />
              <NavBtn active={screen === "doctor"} label={msg("navDoctor")} onClick={() => setScreen("doctor")} />
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-terracotta"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-lg hover:bg-terracotta-muted/40"
        aria-label="Back"
      >
        ←
      </button>
      <h1 className="font-display text-2xl text-ink">{title}</h1>
    </header>
  );
}

function ActionTile({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: string;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-[var(--border)] bg-white p-4 text-left shadow-card transition hover:border-terracotta/40 hover:shadow-lift active:scale-[0.98]"
    >
      <span className="text-2xl">{icon}</span>
      <p className="mt-2 font-semibold text-ink">{label}</p>
      <p className="text-xs text-ink-faint">{desc}</p>
    </button>
  );
}

function VisitRow({ visit, locale }: { visit: Visit; locale: AppLocale }) {
  const { msg } = useLocale();
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-ink-faint">{formatVisitDate(visit.created_at, locale)}</p>
      <p className="mt-1 text-sm font-medium text-ink line-clamp-2">{visit.symptoms_hindi}</p>
      {visit.bp_sys && (
        <p className="mt-1 text-xs text-ink-muted">
          {msg("bpLabel")}: {visit.bp_sys}/{visit.bp_dia}
        </p>
      )}
    </li>
  );
}

function InsightScreen({
  insight,
  loading,
  onBack,
}: {
  insight?: Insight;
  loading: boolean;
  onBack: () => void;
}) {
  const { msg } = useLocale();
  return (
    <div className="px-5 pb-28 pt-6 safe-bottom">
      <BackHeader title={msg("insightTitle")} onBack={onBack} />
      {loading && <p className="mt-8 text-center text-ink-muted">{msg("loading")}</p>}
      {insight && (
        <div className="mt-6 space-y-4">
          <Card className="border-terracotta/20 bg-terracotta-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
              {msg("insightAiSummary")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink">{insight.summary_hi}</p>
            <p className="mt-3 text-xs text-ink-faint">
              {insight.visit_count} {msg("insightVisitsAnalyzed")}
            </p>
          </Card>
          <Card>
            <h3 className="font-semibold text-ink">{msg("insightKyunTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">{msg("insightKyunSub")}</p>
            <ul className="mt-4 space-y-3">
              {insight.kyun.map((k, i) => (
                <li
                  key={`${k.neuron_pair}-${i}`}
                  className="rounded-2xl bg-cream px-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs font-semibold text-terracotta">
                    {k.neuron_pair}
                  </span>
                  <p className="mt-1 text-ink-muted">{k.weight_delta}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function DoctorScreen({
  session,
  visits,
  insight,
  loading,
  onBack,
}: {
  session: PatientSession;
  visits: Visit[];
  insight?: Insight;
  loading: boolean;
  onBack: () => void;
}) {
  const { locale, msg } = useLocale();
  const latestMeds = visits
    .slice()
    .reverse()
    .find((v) => v.medicines)?.medicines;

  return (
    <div className="px-5 pb-28 pt-6 safe-bottom print:pb-4">
      <BackHeader title={msg("doctorView")} onBack={onBack} />
      <p className="mt-2 text-sm text-ink-muted">{msg("doctorDesc")}</p>

      {loading ? (
        <p className="mt-8 text-center text-ink-muted">{msg("loading")}</p>
      ) : (
        <div className="mt-6 space-y-4 print:space-y-3">
          <Card className="print:shadow-none">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <p className="font-display text-2xl text-ink">{session.displayName}</p>
                <p className="text-sm text-ink-muted">
                  {session.age ? `${session.age} ${msg("yearsUnit")}` : ""}
                  {session.gender ? ` · ${session.gender}` : ""}
                  {session.location ? ` · ${session.location}` : ""}
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-terracotta/40 bg-cream text-xs text-center text-ink-faint">
                QR
                <br />
                {msg("qrSoon")}
              </div>
            </div>
          </Card>

          {insight && (
            <Card className="border-l-4 border-l-terracotta">
              <p className="text-xs font-semibold uppercase text-terracotta">{msg("insightTitle")}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{insight.summary_hi}</p>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-ink">{msg("recentVisits")}</h3>
            {visits.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">{msg("noVisits")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {visits
                  .slice()
                  .reverse()
                  .map((v) => (
                    <li key={v.id} className="py-3 first:pt-0">
                      <p className="text-xs text-ink-faint">{formatVisitDate(v.created_at, locale)}</p>
                      <p className="mt-1 text-sm text-ink">{v.symptoms_hindi}</p>
                      {v.doctor_name && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {msg("drLabel")} {v.doctor_name}
                        </p>
                      )}
                      {v.bp_sys && (
                        <p className="text-xs text-ink-muted">
                          {msg("bpLabel")} {v.bp_sys}/{v.bp_dia}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-ink">{msg("medicines")}</h3>
            <p className="mt-2 text-sm text-ink-muted">{latestMeds ?? msg("doctorNoMeds")}</p>
          </Card>

          <p className="text-center text-xs text-ink-faint print:mt-4">{msg("doctorFooter")}</p>
          <Button variant="outline" full className="print:hidden" onClick={() => window.print()}>
            {msg("doctorPrint")}
          </Button>
        </div>
      )}
    </div>
  );
}

function NavBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1 text-xs font-medium transition",
        active ? "text-terracotta" : "text-ink-faint hover:text-ink-muted",
      ].join(" ")}
    >
      <span
        className={[
          "h-1 w-8 rounded-full transition",
          active ? "bg-terracotta" : "bg-transparent",
        ].join(" ")}
      />
      {label}
    </button>
  );
}
