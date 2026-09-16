"use client";

// ---------------------------------------------------------------------------
// useReducedMotion — the ONE shared source of the user's "prefers reduced
// motion" preference for the whole site.
//
// It reads window.matchMedia('(prefers-reduced-motion: reduce)') and returns a
// boolean, subscribing to changes so a mid-session OS toggle is honoured. It is
// SSR-safe: during Next.js static prerender there is no `window`, so the server
// snapshot is `false` (motion-as-today) and `window` is never touched until the
// store is subscribed in the browser after hydration.
//
// It is built on React's useSyncExternalStore, the idiomatic way to read an
// external browser store (like a MediaQueryList) without a setState-in-effect
// cascade: React reads getSnapshot on the client, getServerSnapshot during
// SSR, and re-reads whenever the subscribed change event fires.
//
// CRITICAL: this module imports NO three.js / @react-three / @pixiv-three-vrm
// (mirrors components/three/quality.ts and components/wardrobe/wardrobeOptions.ts
// which are deliberately three-free). That lets BOTH the scene modules AND the
// plain DOM widgets import it WITHOUT dragging the heavy three chunk into a
// static page bundle — the WS1 chunk-split win we must preserve. It also adds
// NO new dependency (only React + the platform matchMedia API).
//
// Usage: read the preference at a client component (a scene wrapper or a DOM
// widget) and either pass it down as a prop or consume it directly to GATE
// motion. It only reports the preference — it changes nothing on its own.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// Subscribe to OS-level changes of the reduced-motion preference. Returns a
// cleanup that removes the listener. No-op on the server (no window).
function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(QUERY);
  // addEventListener is the modern API; guard for older engines that only
  // expose the deprecated addListener.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

// Client snapshot: the live preference from matchMedia.
function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

// Server snapshot: no window during static prerender, so report "not reduced"
// (motion-as-today). This keeps SSR markup and the first client render in sync
// until the real preference is applied post-hydration.
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useReducedMotion;
