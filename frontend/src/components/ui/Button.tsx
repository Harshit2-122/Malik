import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";

const styles: Record<Variant, string> = {
  primary:
    "bg-terracotta text-white shadow-card hover:bg-terracotta-light active:scale-[0.98] disabled:opacity-50",
  secondary: "bg-terracotta-muted text-terracotta hover:bg-[#ebe0da] active:scale-[0.98]",
  ghost: "text-ink-muted hover:bg-terracotta-muted/60 hover:text-ink",
  outline:
    "border-2 border-terracotta/30 text-terracotta bg-white hover:border-terracotta hover:bg-terracotta-muted/40",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }
>(function Button({ variant = "primary", full, className = "", children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200",
        full ? "w-full" : "",
        styles[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
});
