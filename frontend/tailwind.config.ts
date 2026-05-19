import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#fdfaf6",
        terracotta: {
          DEFAULT: "#a8553f",
          light: "#c4714f",
          dark: "#8a4332",
          muted: "#f3e8e4",
        },
        ink: {
          DEFAULT: "#2c1810",
          muted: "#6b5348",
          faint: "#9a857c",
        },
      },
      fontFamily: {
        sans: ["var(--font-hind)", "system-ui", "sans-serif"],
        display: ["var(--font-tiro)", "var(--font-hind)", "serif"],
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(168, 85, 63, 0.12), 0 2px 8px -2px rgba(44, 24, 16, 0.06)",
        lift: "0 12px 40px -8px rgba(168, 85, 63, 0.2)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
export default config;
