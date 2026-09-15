"use client";

// ---------------------------------------------------------------------------
// QualityToggle — the ONE shared High/Fast render-quality control.
//
// A single, visually-minimal control rendered unobtrusively near each scene's
// canvas (in CoachChatbot / ChefChatbot / WardrobeBuilder / VirtualPet). It is
// the SAME control everywhere — not four ad-hoc widgets — wired to the shared
// components/three/quality.ts context via useQuality(). It reads/writes the
// tier only; it imports NO three.js, so placing it in a wrapper never drags the
// heavy three chunk into that wrapper's bundle.
//
// It renders as a small two-button segmented control ("High" / "Fast") using an
// aria radiogroup, so it is keyboard- and screen-reader-accessible and reflects
// the current tier. Styling is theme-agnostic and intentionally subtle so it
// does not disturb the recently-fixed chat/UI layout — the consumer positions
// it (e.g. absolutely in a corner of the stage).
// ---------------------------------------------------------------------------

import { useQuality, type Quality } from "@/components/three/quality";

const TIERS: { value: Quality; label: string; title: string }[] = [
  { value: "high", label: "High", title: "High quality — shadows on" },
  { value: "fast", label: "Fast", title: "Fast — shadows off" },
];

export default function QualityToggle({
  className = "",
}: {
  // Extra classes so each consumer can position the control (e.g. absolute in a
  // stage corner) without changing the control itself.
  className?: string;
}) {
  const { quality, setQuality } = useQuality();
  return (
    <div
      role="radiogroup"
      aria-label="Render quality"
      className={[
        "inline-flex items-center gap-0.5 rounded-full border border-black/15 bg-white/80 p-0.5 shadow-sm backdrop-blur-sm",
        className,
      ].join(" ")}
    >
      {TIERS.map(({ value, label, title }) => {
        const isSel = quality === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSel}
            title={title}
            onClick={() => setQuality(value)}
            className={[
              "rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40",
              isSel
                ? "bg-black/85 text-white"
                : "text-black/60 hover:text-black/90",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
