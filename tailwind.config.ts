import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background:   "var(--color-background)",
        "surface-0":  "var(--color-surface-0)",
        surface:      "var(--color-surface)",
        "surface-2":  "var(--color-surface-2)",
        "surface-3":  "var(--color-surface-3)",
        "neon-bg":    "var(--color-neon-bg)",
        neon:         "var(--color-neon)",
        "neon-dim":   "var(--color-neon-dim)",
        "neon-text":  "var(--color-neon-text)",
        blue:         "var(--color-blue)",
        "blue-dim":   "var(--color-blue-dim)",
        orange:       "var(--color-orange)",
        "orange-dim": "var(--color-orange-dim)",
        muted:        "var(--color-muted)",
        subtle:       "var(--color-subtle)",
        dim:          "var(--color-dim)",
        secondary:    "var(--color-secondary)",
        strava:       "var(--color-strava)",
        error:        "var(--color-error)",
      },
      zIndex: {
        nav: "50",
        sheet: "60",
        dropdown: "61",
        modal: "70",
        toast: "80",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg": ["4rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-md": ["2.5rem", { lineHeight: "1.1", fontWeight: "700" }],
      },
      boxShadow: {
        neon: "0 0 20px rgba(205, 255, 0, 0.3)",
        "neon-sm": "0 0 10px rgba(205, 255, 0, 0.2)",
        orange: "0 0 20px rgba(208, 121, 0, 0.3)",
        "orange-sm": "0 0 10px rgba(208, 121, 0, 0.2)",
        blue: "0 0 20px rgba(107, 210, 255, 0.3)",
        "blue-sm": "0 0 10px rgba(107, 210, 255, 0.2)",
        "card": "0 8px 30px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(205,255,0,0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(205,255,0,0.5)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
