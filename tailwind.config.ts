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
        // Warm, cozy Tamagotchi virtual-pet palette. Soft cream/paper
        // backgrounds, a friendly teal-ish primary accent, an amber "feed"
        // affordance, and semantic good/warn/crit colors for the stat bars.
        // Kept separate from `cloud`, `ac`, and `sf`, which the rest of the
        // site uses.
        pet: {
          cream: "#fbf3e4", // page/stage background (soft cream)
          paper: "#fffaf0", // card/panel surface (warm paper white)
          ink: "#5a4632", // primary text (muted warm brown)
          inkSoft: "#8a745a", // secondary/label text
          accent: "#e08a4c", // friendly primary accent (warm terracotta)
          accentSoft: "#f4c99a", // soft accent tint (chips, borders)
          feed: "#f0a63c", // "feed" action (warm amber/orange)
          play: "#e07a9a", // "play" action (playful rose)
          rest: "#7c9bd6", // "sleep/rest" action (calm blue)
          clean: "#5fc2c7", // "clean" action (fresh teal)
          good: "#7cc47a", // stat is healthy (soft green)
          warn: "#f0b429", // stat is getting low (warm amber)
          crit: "#e5674e", // stat is low/critical (warm coral red)
          mist: "#efe2c9", // subtle borders / bar track
        },
        // Pet Puzzles palette: the warm paper/wood ground the two tile games
        // are drawn on, with the pink of Pet Jump and the leaf green of Pet
        // Tower Sort as the two mode accents. Kept separate from `cloud`,
        // `ac`, `sf`, and `pet`, which the rest of the site uses.
        puz: {
          cream: "#f4ede3",    // page ground
          paper: "#fffcf7",    // card/panel surface
          rim: "#dcc9b2",      // borders, tile edges
          ink: "#3f342b",      // primary text
          inkSoft: "#8c7a66",  // secondary text
          pink: "#ee6e96",     // Pet Jump accent
          pinkDeep: "#b93c66", // Pet Jump accent, on light
          leaf: "#2f8f6b",     // Pet Tower Sort accent
          leafDeep: "#1c6147", // Pet Tower Sort accent, on light
          sun: "#e0961a",      // completed-tower gold
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
