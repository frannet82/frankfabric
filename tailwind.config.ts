import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cloud: {
          bg: "#05060c",
          panel: "#0d1018",
          blue: "#3fa9ff",
          violet: "#9b6bff",
          mist: "#5ff2df",
        },
        // Animal-Crossing-inspired cozy pastel palette. Warm cream/beige
        // backgrounds, soft leaf greens, sunflower yellow/orange accents, a
        // gentle sky blue, and soft brown text. Used by the chef chatbot to
        // give it a friendly, rounded, cozy look. Kept separate from `cloud`
        // (which the rest of the site still uses).
        ac: {
          cream: "#fdf6e3",
          sand: "#f5e8c7",
          beige: "#efdfb8",
          leaf: "#8fce7a",
          leafDark: "#5fa85a",
          moss: "#3f7d3a",
          sun: "#ffcf5c",
          orange: "#f6a545",
          sky: "#8fd3e8",
          brown: "#6b4f2a",
          brownSoft: "#8a6b42",
        },
        // Smart Fit gym-inspired palette: bold, high-energy yellow/black with
        // magenta accents (the chain's signature look). Used by the coach
        // trainer page/widget/preview to give it an energetic fitness vibe.
        // Kept separate from `cloud` and `ac`, which the rest of the site uses.
        sf: {
          yellow: "#FFF200",
          gold: "#FCE300",
          black: "#111111",
          ink: "#1a1a1a",
          magenta: "#E6007E",
          pink: "#ff4fb0",
          gray: "#2a2a2a",
          mist: "#f4f4f4",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        emberPulse: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
        floatY: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        ringSpin: { to: { transform: "rotate(360deg)" } },
        scan: { from: { transform: "translateY(-100%)" }, to: { transform: "translateY(100vh)" } },
        ticker: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        marquee: "marquee 26s linear infinite",
        emberPulse: "emberPulse 2s ease-in-out infinite",
        floatY: "floatY 5s ease-in-out infinite",
        ringSpin: "ringSpin 46s linear infinite",
        scan: "scan 7s linear infinite",
        ticker: "ticker 40s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
