"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D outfit builder.
//
// The 3D avatar is a real rigged VRM humanoid ("Seed-san") loaded with
// @pixiv/three-vrm (see components/wardrobe/WardrobeScene.tsx). This file
// renders the control UI (category tabs, per-category option buttons, and a
// color picker) and streams the selection state into the scene, where it
// recolors the avatar's built-in outfit and toggles bone-anchored garments.
//
// The WebGL canvas MUST NOT run during Next.js static generation (three.js
// touches window/document), so WardrobeScene is loaded via next/dynamic with
// { ssr: false } and a loading fallback.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  OPTIONS,
  type Category,
  type WardrobeSelection,
  type WardrobeColors,
  type WardrobeAnimation,
} from "@/components/wardrobe/WardrobeScene";
import { asset } from "@/lib/asset";

const WardrobeScene = dynamic(
  () => import("@/components/wardrobe/WardrobeScene"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center text-[#8f8a80]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 rounded-full border-2 border-[#c9c3b7] border-t-[#2c2a26] animate-spin" />
          <span style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-lg">
            Preparing the atelier…
          </span>
        </div>
      </div>
    ),
  }
);

const ORDER: Category[] = ["outfit", "bottom", "shoes", "hat"];
const LABELS: Record<Category, string> = {
  outfit: "Outfit",
  bottom: "Bottoms",
  shoes: "Shoes",
  hat: "Hat",
};

// ---------------------------------------------------------------------------
// Atelier palette — a curated, accessible capsule wardrobe.
//
// The palette is built from warm neutrals plus a small set of muted, fashion
// forward accents so any combination reads as a coherent outfit. Every hue is
// chosen to hold contrast against the light atelier background (#efede8 /
// #faf9f7) and the dark UI chrome (#2c2a26). Shared roles:
//   #f4f1ea  Ivory      near-white; kept bordered so it stays visible on the light bg
//   #d9cdbb  Sand       warm light neutral
//   #b8b0a4  Stone      mid greige neutral
//   #2f2b28  Espresso   near-black; anchors an outfit and reads on light bg
//   #a65a4b  Terracotta warm clay accent (primary brand-ish accent)
//   #5f7355  Sage       muted olive green accent
//   #3f5a6b  Slate      desaturated blue accent
//   #c98a3c  Ochre      golden amber accent
//   #7d5a72  Plum       dusty mauve accent
//   #8a5a3c  Cognac     rich tan/leather tone (footwear)
// ---------------------------------------------------------------------------
const SWATCHES: Record<Category, string[]> = {
  // Outfit: neutral base tones + two accents that flatter the avatar's torso.
  outfit: ["#f4f1ea", "#a65a4b", "#3f5a6b", "#5f7355", "#2f2b28"],
  // Bottoms: grounding darks + denim-like slate + a warm ochre option.
  bottom: ["#3f5a6b", "#2f2b28", "#5f7355", "#c98a3c", "#b8b0a4"],
  // Shoes: classic leather/neutral shoe tones.
  shoes: ["#2f2b28", "#8a5a3c", "#f4f1ea", "#a65a4b"],
  // Hat: accents and neutrals that top off the looks above.
  hat: ["#2f2b28", "#a65a4b", "#d9cdbb", "#7d5a72"],
};

// Genuine 512x512 garment thumbnails copied from the frannet82/assets repo
// into public/wardrobe/thumbnails/. Each entry maps a category + option index
// to a preview image so users can see what each selection looks like. Option 0
// ("Default"/"None") has no garment, so it renders a labeled placeholder tile
// instead. Every path is wrapped in asset() so it carries the /frankfabric
// base path in production.
const THUMBNAILS: Record<Category, (string | null)[]> = {
  outfit: [null, "/wardrobe/thumbnails/outfit-jacket.png", "/wardrobe/thumbnails/outfit-vest.png"],
  bottom: [
    null,
    "/wardrobe/thumbnails/bottom-trousers.png",
    "/wardrobe/thumbnails/bottom-shorts.png",
    "/wardrobe/thumbnails/bottom-skirt.png",
  ],
  shoes: [null, "/wardrobe/thumbnails/shoes-sneakers.png", "/wardrobe/thumbnails/shoes-boots.png"],
  hat: [null, "/wardrobe/thumbnails/hat-cap.png", "/wardrobe/thumbnails/hat-beanie.png"],
};

// Animation selector options. "rest" is the static, auto-rotating pose; the
// others play the retargeted FBX clips on the VRM rig.
const ANIMATIONS: { value: WardrobeAnimation; label: string }[] = [
  { value: "rest", label: "Rest" },
  { value: "idle", label: "Idle" },
  { value: "walking", label: "Walking" },
  { value: "waving", label: "Waving" },
];

export default function WardrobeBuilder() {
  const [active, setActive] = useState<Category>("outfit");
  const [animation, setAnimation] = useState<WardrobeAnimation>("idle");
  // Default first-load look: a fully layered, cohesive outfit so the atelier
  // opens on the same styled avatar depicted in the project preview image,
  // rather than an unstyled default. Each index maps to a *visible* option in
  // OPTIONS (see WardrobeScene): outfit=Jacket, bottom=Trousers, shoes=Boots,
  // hat=Cap. Option 0 ("Default"/"None") stays meaningful — users can strip
  // any layer back to it — but the initial selection intentionally skips it.
  const [selection, setSelection] = useState<WardrobeSelection>({
    outfit: 1, // Jacket
    bottom: 1, // Trousers
    shoes: 2, // Boots
    hat: 1, // Cap
  });
  // Colours pair with the selection above: terracotta jacket over slate
  // trousers, cognac boots and an espresso cap — a warm-neutral starting look.
  const [colors, setColors] = useState<WardrobeColors>({
    outfit: "#a65a4b", // Terracotta
    bottom: "#3f5a6b", // Slate
    shoes: "#8a5a3c", // Cognac
    hat: "#2f2b28", // Espresso
  });

  const setOption = (cat: Category, idx: number) =>
    setSelection((s) => ({ ...s, [cat]: idx }));
  const setColor = (cat: Category, color: string) =>
    setColors((c) => ({ ...c, [cat]: color }));

  const sceneProps = useMemo(
    () => ({ selection, colors, animation }),
    [selection, colors, animation]
  );

  return (
    <div
      className="relative w-full flex flex-col overflow-hidden rounded-3xl"
      style={{
        minHeight: 760,
        fontFamily: "Jost, sans-serif",
        color: "#2c2a26",
        background:
          "radial-gradient(120% 90% at 50% 0%,#faf9f7 0%,#efede8 55%,#e4e1da 100%)",
      }}
    >
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 flex-wrap">
        <div>
          <div
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
            className="text-2xl font-semibold tracking-widest leading-none"
          >
            ATELIER
          </div>
          <div className="text-[11px] tracking-[4px] uppercase text-[#8f8a80] mt-[2px]">
            Digital Wardrobe · by Frank Cloud Fabric
          </div>
        </div>
        <span className="text-[11px] tracking-widest uppercase text-[#a39d92] hidden sm:block">
          Drag to rotate · scroll to zoom
        </span>
      </header>

      {/* 3D stage */}
      <main className="relative z-10 flex-1 min-h-[420px]">
        <div className="absolute inset-0">
          <WardrobeScene {...sceneProps} />
        </div>
      </main>

      {/* controls */}
      <footer className="relative z-10 px-4 sm:px-8 pb-7 pt-3">
        {/* category tabs */}
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {ORDER.map((cat) => {
            const isActive = active === cat;
            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={[
                  "px-4 py-2 rounded-full text-sm tracking-wide transition-all duration-150 border",
                  isActive
                    ? "bg-[#2c2a26] text-[#f6f4ef] border-[#2c2a26]"
                    : "bg-white/70 text-[#4a463f] border-[#e2ded6] hover:border-[#bcb7ac]",
                ].join(" ")}
              >
                {LABELS[cat]}
              </button>
            );
          })}
        </div>

        {/* option cards for the active category — each shows a garment
            thumbnail preview above its name (option 0 = None/Default gets a
            labeled placeholder tile). Cards keep the button semantics + aria
            labels for keyboard/screen-reader access. */}
        <div className="flex justify-center gap-3 mb-5 flex-wrap">
          {OPTIONS[active].map((name, idx) => {
            const isSel = selection[active] === idx;
            const thumb = THUMBNAILS[active][idx] ?? null;
            return (
              <button
                key={name}
                onClick={() => setOption(active, idx)}
                aria-pressed={isSel}
                aria-label={`${LABELS[active]}: ${name}`}
                className={[
                  "group flex flex-col items-center gap-2 p-2 rounded-2xl border transition-all duration-150 w-[92px]",
                  isSel
                    ? "bg-[#a65a4b]/10 border-[#a65a4b] ring-2 ring-[#a65a4b]/30"
                    : "bg-white/70 border-[#e2ded6] hover:border-[#bcb7ac]",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative grid place-items-center w-[72px] h-[72px] rounded-xl overflow-hidden border",
                    isSel ? "border-[#a65a4b]/40" : "border-[#e6e2da]",
                  ].join(" ")}
                  style={{
                    background:
                      "repeating-conic-gradient(#f3f0ea 0% 25%, #e9e5dd 0% 50%) 50% / 16px 16px",
                  }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset(thumb)}
                      alt={`${name} preview`}
                      width={72}
                      height={72}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] tracking-widest uppercase text-[#a39d92] px-1 text-center">
                      {name}
                    </span>
                  )}
                </span>
                <span
                  className={[
                    "text-xs tracking-wide",
                    isSel ? "text-[#a65a4b] font-medium" : "text-[#4a463f]",
                  ].join(" ")}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>

        {/* animation selector — sets the clip played on the VRM rig. */}
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          <span className="text-[11px] tracking-widest uppercase text-[#a39d92]">
            Animation
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {ANIMATIONS.map(({ value, label }) => {
              const isSel = animation === value;
              return (
                <button
                  key={value}
                  onClick={() => setAnimation(value)}
                  aria-pressed={isSel}
                  aria-label={`Play ${label} animation`}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs tracking-wide transition-all duration-150 border",
                    isSel
                      ? "bg-[#2c2a26] text-[#f6f4ef] border-[#2c2a26]"
                      : "bg-white/70 text-[#4a463f] border-[#e2ded6] hover:border-[#bcb7ac]",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* color swatches */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="text-[11px] tracking-widest uppercase text-[#a39d92]">
            {LABELS[active]} colour
          </span>
          <div className="flex items-center gap-2">
            {SWATCHES[active].map((color) => {
              const isSel = colors[active].toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => setColor(active, color)}
                  aria-label={`Set ${LABELS[active]} colour to ${color}`}
                  className={[
                    "w-7 h-7 rounded-full border transition-transform duration-150",
                    isSel
                      ? "border-[#2c2a26] scale-110 ring-2 ring-[#2c2a26]/25"
                      : "border-[#d9d4cb] hover:scale-105",
                  ].join(" ")}
                  style={{ background: color }}
                />
              );
            })}
            <label className="relative w-7 h-7 rounded-full overflow-hidden border border-[#d9d4cb] cursor-pointer grid place-items-center bg-white/70">
              <span className="text-[13px] leading-none text-[#8f8a80]">+</span>
              <input
                type="color"
                value={colors[active]}
                onChange={(e) => setColor(active, e.target.value)}
                aria-label={`Pick a custom ${LABELS[active]} colour`}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </footer>
    </div>
  );
}
