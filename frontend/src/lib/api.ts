const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function getApiBase() {
  return apiBase;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      `BACKEND_UNREACHABLE|${apiBase}`,
    );
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.detail ?? body.message ?? JSON.stringify(body);
    } catch {
      msg = (await res.text()) || msg;
    }
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Patient = {
  id: string;
  display_name: string;
  age: number | null;
  locale: string;
  created_at?: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  symptoms_hindi: string;
  doctor_name: string | null;
  bp_sys: number | null;
  bp_dia: number | null;
  medicines: string | null;
  created_at: string;
};

export type Insight = {
  patient_id: string;
  visit_count: number;
  summary_hi: string;
  kyun: { neuron_pair: string; weight_delta: string }[];
  activated_keywords?: string[];
  sigma_frobenius?: number;
};

export const api = {
  health: () => request<{ database: string; status: string }>("/health"),
  createPatient: (body: { display_name: string; age?: number; locale?: string }) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(body) }),
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  listVisits: (id: string) => request<Visit[]>(`/patients/${id}/visits`),
  addVisit: (
    id: string,
    body: {
      symptoms_hindi: string;
      doctor_name?: string;
      bp_sys?: number;
      bp_dia?: number;
      medicines?: string;
    },
  ) => request<Visit>(`/patients/${id}/visits`, { method: "POST", body: JSON.stringify(body) }),
  insight: (id: string, locale?: string) =>
    request<Insight>(`/patients/${id}/insight?locale=${encodeURIComponent(locale ?? "hi")}`),
};

export function formatApiError(err: unknown, tBackend: string, tNetwork: string): string {
  if (err instanceof Error) {
    if (err.message.startsWith("BACKEND_UNREACHABLE|")) {
      return tBackend;
    }
    if (err.message === "Failed to fetch") {
      return tNetwork;
    }
    return err.message;
  }
  return tNetwork;
}
