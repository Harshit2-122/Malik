import { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-card",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
