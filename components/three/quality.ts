"use client";

// ---------------------------------------------------------------------------
// Shared render-quality concept for ALL FOUR 3D scenes (coach, chef, wardrobe,
// pet). This is the ONE quality system for the site — every scene consumes it,
// so there is never a per-scene ad-hoc widget.
//
// Modeled on the tireshop reference (src/ui/Panels.jsx "High — shadows on" /
// "Fast — shadows off" and src/avatar/ShopStage.jsx's use of quality to gate
// Canvas `shadows`, `dpr`, shadow-map resolution and the heavier lights):
//   High => shadows on,  dpr [1,2], higher shadow-map res, soft shadows, extra
//           fill/bounce lights, ground/backdrop depth.
//   Fast => shadows off, dpr capped NO higher than today's [1,2] (we drop it to
//           [0.75,1.25] so Fast is at-least-as-cheap as before), minimal lights.
//
// CRITICAL: this module imports NO three.js / @react-three / @pixiv-three-vrm.
// It mirrors components/wardrobe/wardrobeOptions.ts, which is deliberately
// three-free so the control UIs (chatbot/builder/pet wrappers) can read the
// quality preference WITHOUT dragging the heavy three chunk into a static page
// bundle — a WS1 chunk-split win we must preserve. Anything that needs a
// three.js value (e.g. a THREE.Vector2 shadow-map size) derives it from these
// plain numbers INSIDE the scene module, never here.
// ---------------------------------------------------------------------------

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// The two quality tiers, matching tireshop's selector semantics.
export type Quality = "high" | "fast";

// Default tier on first load. High matches today's behaviour (all four Canvases
// already render with shadows on and dpr [1,2]), so defaulting to High keeps
// the out-of-the-box look identical to before this feature.
export const DEFAULT_QUALITY: Quality = "high";

// Plain (three-free) render settings derived from a Quality tier. Scene modules
// read these numbers and translate them into three.js values locally. Keeping
// them here as primitives is what lets this module stay three-free.
export type QualitySettings = {
  // Whether the Canvas enables the WebGL shadow map at all (tireshop pattern:
  // shadows only on High). Fast turns them off entirely — cheaper than today.
  shadows: boolean;
  // Device-pixel-ratio clamp passed to <Canvas dpr>. High matches today's
  // [1, 2]; Fast is capped LOWER so it is never more expensive than today.
  dpr: [number, number];
  // Shadow-map resolution (per axis) for the key light. High goes above today's
  // 1024; Fast is unused (shadows off) but kept low for safety.
  shadowMapSize: number;
  // Whether to render the heavier soft-shadow / extra-fill-light / backdrop
  // depth effects. Gated to High so Fast stays lean.
  softShadows: boolean;
};

const HIGH_SETTINGS: QualitySettings = {
  shadows: true,
  dpr: [1, 2],
  shadowMapSize: 2048,
  softShadows: true,
};

const FAST_SETTINGS: QualitySettings = {
  shadows: false,
  // Lowered from today's [1, 2] so the Fast path is strictly at-least-as-cheap
  // as before (an explicitly-allowed way to keep Fast lean per the plan).
  dpr: [0.75, 1.25],
  shadowMapSize: 512,
  softShadows: false,
};

// Pure mapping from tier -> settings. Exported so scene modules can resolve
// settings from a plain `quality` prop without pulling in the React context.
export function qualitySettings(quality: Quality): QualitySettings {
  return quality === "high" ? HIGH_SETTINGS : FAST_SETTINGS;
}

// Human-readable labels for the shared control (mirrors tireshop's Panels.jsx).
export const QUALITY_LABELS: Record<Quality, string> = {
  high: "High — shadows on",
  fast: "Fast — shadows off",
};

// ---------------------------------------------------------------------------
// React context + hook. Each scene widget wraps its stage in <QualityProvider>
// and reads the tier with useQuality(); the shared <QualityToggle> flips it.
// This keeps the preference local to each widget (no cross-page global state),
// while guaranteeing a SINGLE shared concept/type/control across all scenes.
// ---------------------------------------------------------------------------

type QualityContextValue = {
  quality: Quality;
  setQuality: (q: Quality) => void;
  toggleQuality: () => void;
};

const QualityContext = createContext<QualityContextValue | null>(null);

export function QualityProvider({
  children,
  initial = DEFAULT_QUALITY,
}: {
  children: ReactNode;
  initial?: Quality;
}) {
  const [quality, setQuality] = useState<Quality>(initial);
  const toggleQuality = useCallback(
    () => setQuality((q) => (q === "high" ? "fast" : "high")),
    []
  );
  const value = useMemo<QualityContextValue>(
    () => ({ quality, setQuality, toggleQuality }),
    [quality, toggleQuality]
  );
  // Use createElement rather than JSX so this stays a plain .ts module.
  return createElement(QualityContext.Provider, { value }, children);
}

// Read the current quality tier + setters. Falls back to the default tier when
// used outside a provider so a scene rendered bare still behaves like today.
export function useQuality(): QualityContextValue {
  const ctx = useContext(QualityContext);
  if (ctx) return ctx;
  return {
    quality: DEFAULT_QUALITY,
    setQuality: () => {},
    toggleQuality: () => {},
  };
}
