"use client";

import { LOCALE_OPTIONS, type AppLocale } from "@/lib/locale";

export function LanguageSelector({
  value,
  onChange,
  label,
}: {
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
  label: string;
}) {
  return (
    <label className="block">
      {label ? <span className="text-sm font-medium text-ink">{label}</span> : null}
      <div className={label ? "relative mt-1.5" : "relative"}>
        <select
          className="field-input appearance-none pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value as AppLocale)}
        >
          {LOCALE_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.native} · {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint">
          ▾
        </span>
      </div>
    </label>
  );
}
