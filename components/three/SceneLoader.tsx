"use client";

// ---------------------------------------------------------------------------
// SceneLoader — a real loading indicator for the Suspense fallback inside a
// react-three-fiber <Canvas>.
//
// It reads drei's useProgress (which tracks three's LoadingManager) and renders
// a small percentage readout + spinner through drei's <Html center> so it lives
// in the DOM over the canvas. This replaces the blank <Suspense fallback={null}>
// that previously showed nothing while the (multi-MB) VRM/GLB/FBX/OBJ assets
// streamed in.
//
// IMPORTANT: useProgress and <Html> both require the react-three-fiber context,
// so this component MUST be used as the CHILD fallback INSIDE the Canvas's
// <Suspense fallback={<SceneLoader />}> — exactly where fallback={null} used to
// be — never as plain DOM outside the Canvas. A component that suspends cannot
// also report its own progress, so SceneLoader lives OUTSIDE (as the fallback
// of) the boundary whose progress it reports.
//
// It draws nothing scene-side (no meshes, no lights) and never touches tone
// mapping / exposure / camera, so it cannot change how any scene renders once
// loaded. A single shared indicator is used across all four 3D scenes.
// ---------------------------------------------------------------------------

import { Html, useProgress } from "@react-three/drei";

export default function SceneLoader() {
  const { active, progress } = useProgress();
  const pct = active ? Math.round(progress) : 100;
  return (
    <Html center prepend style={{ pointerEvents: "none" }}>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          // Neutral, theme-agnostic chrome so it reads over every scene's
          // background without recoloring anything scene-side.
          color: "#4a463f",
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "9999px",
            border: "2px solid rgba(120,120,120,0.3)",
            borderTopColor: "#4a463f",
            animation: "sceneLoaderSpin 0.8s linear infinite",
          }}
        />
        <span>Loading… {pct}%</span>
        {/* Keyframes are scoped by a unique name so they don't collide with
            any app CSS. Inlined here so the loader is fully self-contained. */}
        <style>{`@keyframes sceneLoaderSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Html>
  );
}
