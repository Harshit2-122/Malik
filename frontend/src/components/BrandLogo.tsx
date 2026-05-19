"use client";

import { useLocale } from "@/lib/locale-context";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const { msg } = useLocale();
  const text = size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta text-lg text-white shadow-card"
        aria-hidden
      >
        स
      </span>
      <div>
        <p className={`font-display ${text} font-normal leading-tight text-ink`}>
          स्मृति <span className="text-terracotta">Smriti</span>
        </p>
        {size === "md" && <p className="text-xs text-ink-faint">{msg("brandTagline")}</p>}
      </div>
    </div>
  );
}
