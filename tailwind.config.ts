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
        background: "#0a0a0a",
        surface: "#111111",
        "surface-2": "#1a1a1a",
        "surface-3": "#222222",
        neon: "#39ff14",
        "neon-dim": "#1a7a09",
        orange: "#ff6b00",
        "orange-dim": "#7a3300",
        muted: "#555555",
        subtle: "#333333",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Anton", "Impact", "sans-serif"],
        body: ["var(--font-outfit)", "DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg": ["4rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-md": ["2.5rem", { lineHeight: "1.1", fontWeight: "700" }],
      },
      boxShadow: {
        neon: "0 0 20px rgba(57, 255, 20, 0.3)",
        "neon-sm": "0 0 10px rgba(57, 255, 20, 0.2)",
        orange: "0 0 20px rgba(255, 107, 0, 0.3)",
        "orange-sm": "0 0 10px rgba(255, 107, 0, 0.2)",
      },
      animation: {
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(57,255,20,0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(57,255,20,0.5)" },
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
