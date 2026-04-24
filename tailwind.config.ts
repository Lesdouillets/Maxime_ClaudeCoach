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
        background: "#000000",
        surface: "#1C1C1E",
        "surface-2": "#2C2C2E",
        "surface-3": "#3A3A3C",
        primary: "#0A84FF",
        success: "#30D158",
        warning: "#FF9F0A",
        danger: "#FF453A",
        muted: "rgba(235,235,245,0.3)",
        subtle: "rgba(255,255,255,0.08)",
        // Legacy aliases kept for gradual migration
        neon: "#30D158",
        "neon-dim": "#1D6535",
        orange: "#FF9F0A",
        "orange-dim": "#7A4F00",
      },
      fontFamily: {
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        body: ["var(--font-outfit)", "DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-lg": ["4rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-md": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        elevated: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        "inset-highlight": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "spring-in": "spring-in 0.4s cubic-bezier(0.34,1.56,0.64,1)",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "spring-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
