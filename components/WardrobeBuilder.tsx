"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D outfit builder.
//
// The 3D avatar is a minimally-clothed modular base body VRM ("drophunter")
// loaded with @pixiv/three-vrm (see components/wardrobe/WardrobeScene.tsx).
// This file renders the control UI and streams the selection state into the
// scene, where it loads REAL fitted garment VRMs and transplants them onto the
// base skeleton.
//
// Layout: the 3D stage sits in the CENTER, flanked by two VERTICAL side menus.
// SHOES + HAIR live on the LEFT; TOP (outfit) + BOTTOMS live on the RIGHT. Each
// side column presents both of its categories as labeled, vertically-stacked
// scrollable sections of option cards, each with its own colour swatches. On
// narrow screens the three columns stack: stage on top, then the four menu
// sections full-width below.
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
} from "@/components/wardrobe/wardrobeOptions";
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

const LABELS: Record<Category, string> = {
  outfit: "Top",
  bottom: "Bottoms",
  shoes: "Shoes",
  hat: "Hair",
};

// Which categories live in which vertical side menu. Shoes + Hair on the LEFT,
// Top (outfit) + Bottoms on the RIGHT, flanking the centered 3D stage.
const LEFT_CATEGORIES: Category[] = ["shoes", "hat"];
const RIGHT_CATEGORIES: Category[] = ["outfit", "bottom"];

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
  // Top: neutral base tones + two accents that flatter the avatar's torso.
  outfit: ["#f4f1ea", "#a65a4b", "#3f5a6b", "#5f7355", "#2f2b28"],
  // Bottoms: grounding darks + denim-like slate + a warm ochre option.
  bottom: ["#3f5a6b", "#2f2b28", "#5f7355", "#c98a3c", "#b8b0a4"],
  // Shoes: classic leather/neutral shoe tones.
  shoes: ["#2f2b28", "#8a5a3c", "#f4f1ea", "#a65a4b"],
  // Hair: natural hair tones (near-black, brown, blonde) plus a bold accent.
  hat: ["#2f2b28", "#8a5a3c", "#d9cdbb", "#7d5a72"],
};

// Genuine 512x512 garment thumbnails copied into public/wardrobe/thumbnails/
// (named <category>-<name>.png). Each entry maps a category + option index to a
// preview image so users can see what each selection looks like. Option 0
// ("Base"/"None") mounts no garment, so it renders a labeled placeholder tile
// instead. Every path is wrapped in asset() so it carries the /frankfabric
// base path in production. Order matches OPTIONS in WardrobeScene exactly.
const THUMBNAILS: Record<Category, (string | null)[]> = {
  outfit: [
    null,
    "/wardrobe/thumbnails/chest-tanktop.png",
    "/wardrobe/thumbnails/chest-shirt.png",
    "/wardrobe/thumbnails/chest-hoodie.png",
    "/wardrobe/thumbnails/chest-croptop.png",
    "/wardrobe/thumbnails/chest-lightshirt.png",
    "/wardrobe/thumbnails/chest-fulljacket.png",
    "/wardrobe/thumbnails/chest-tuckedshirt.png",
    "/wardrobe/thumbnails/chest-sweater.png",
  ],
  bottom: [
    null,
    "/wardrobe/thumbnails/legs-cargopants.png",
    "/wardrobe/thumbnails/legs-casualshorts.png",
    "/wardrobe/thumbnails/legs-skirt.png",
    "/wardrobe/thumbnails/legs-sportshorts.png",
    "/wardrobe/thumbnails/legs-abovekneeshorts.png",
    "/wardrobe/thumbnails/legs-waistshorts.png",
    "/wardrobe/thumbnails/legs-doublebeltpants.png",
  ],
  shoes: [
    null,
    "/wardrobe/thumbnails/feet-sneakers.png",
    "/wardrobe/thumbnails/feet-shortboots.png",
    "/wardrobe/thumbnails/feet-thinshoe.png",
    "/wardrobe/thumbnails/feet-dressboots.png",
    "/wardrobe/thumbnails/feet-tallboots.png",
    "/wardrobe/thumbnails/feet-tennisshoes.png",
    "/wardrobe/thumbnails/feet-hightop.png",
  ],
  hat: [
    null,
    "/wardrobe/thumbnails/head-short.png",
    "/wardrobe/thumbnails/head-ponytail.png",
    "/wardrobe/thumbnails/head-curledbangs.png",
    "/wardrobe/thumbnails/head-buns.png",
    "/wardrobe/thumbnails/head-straight.png",
    "/wardrobe/thumbnails/head-swept.png",
    "/wardrobe/thumbnails/head-longspike.png",
    "/wardrobe/thumbnails/head-dreds.png",
  ],
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
  const [animation, setAnimation] = useState<WardrobeAnimation>("idle");
  // Default first-load look: a cohesive fully-clothed outfit so the atelier
  // opens on a styled avatar rather than the near-nude base body. Each index
  // maps to a *visible* garment in OPTIONS (see WardrobeScene): outfit=Shirt,
  // bottom=Cargo Pants, shoes=Sneakers, hat=Short (hair). Option 0
  // ("Base"/"None") stays meaningful — users can strip any layer back to the
  // base body — but the initial selection intentionally skips it.
  const [selection, setSelection] = useState<WardrobeSelection>({
    outfit: 2, // Shirt
    bottom: 1, // Cargo Pants
    shoes: 1, // Sneakers
    hat: 1, // Short (hair)
  });
  // Colours pair with the selection above: a warm-neutral starting look that
  // tints each real garment's materials via the scene's applyColor().
  const [colors, setColors] = useState<WardrobeColors>({
    outfit: "#a65a4b", // Terracotta
    bottom: "#3f5a6b", // Slate
    shoes: "#2f2b28", // Espresso
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

  // A single category's vertical menu section: heading, scrollable stack of
  // option cards (thumbnail above name), and a compact colour-swatch row. Used
  // for all four categories in both side menus.
  const renderCategorySection = (cat: Category) => {
    const headingId = `wardrobe-section-${cat}`;
    return (
      <section
        key={cat}
        aria-labelledby={headingId}
        className="flex flex-col min-h-0"
      >
        <h3
          id={headingId}
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
          className="text-lg font-semibold tracking-wide mb-2 text-[#2c2a26]"
        >
          {LABELS[cat]}
        </h3>

        {/* option cards — thumbnail above name, stacked vertically; scrolls
            when the list is long. Cards keep button semantics + aria labels. */}
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[300px] lg:max-h-[38vh]">
          {OPTIONS[cat].map((name, idx) => {
            const isSel = selection[cat] === idx;
            const thumb = THUMBNAILS[cat][idx] ?? null;
            return (
              <button
                key={name}
                onClick={() => setOption(cat, idx)}
                aria-pressed={isSel}
                aria-label={`${LABELS[cat]}: ${name}`}
                className={[
                  "group flex items-center gap-3 p-2 rounded-2xl border transition-all duration-150 text-left w-full",
                  isSel
                    ? "bg-[#a65a4b]/10 border-[#a65a4b] ring-2 ring-[#a65a4b]/30"
                    : "bg-white/70 border-[#e2ded6] hover:border-[#bcb7ac]",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative grid place-items-center w-[56px] h-[56px] shrink-0 rounded-xl overflow-hidden border",
                    isSel ? "border-[#a65a4b]/40" : "border-[#e6e2da]",
                  ].join(" ")}
                  style={{
                    background:
                      "repeating-conic-gradient(#f3f0ea 0% 25%, #e9e5dd 0% 50%) 50% / 14px 14px",
                  }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset(thumb)}
                      alt={`${name} preview`}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] tracking-widest uppercase text-[#a39d92] px-1 text-center">
                      {name}
                    </span>
                  )}
                </span>
                <span
                  className={[
                    "text-sm tracking-wide",
                    isSel ? "text-[#a65a4b] font-medium" : "text-[#4a463f]",
                  ].join(" ")}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>

        {/* per-section colour swatches — every category's colour is directly
            adjustable within its own menu. */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {SWATCHES[cat].map((color) => {
            const isSel = colors[cat].toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                onClick={() => setColor(cat, color)}
                aria-label={`Set ${LABELS[cat]} colour to ${color}`}
                className={[
                  "w-6 h-6 rounded-full border transition-transform duration-150",
                  isSel
                    ? "border-[#2c2a26] scale-110 ring-2 ring-[#2c2a26]/25"
                    : "border-[#d9d4cb] hover:scale-105",
                ].join(" ")}
                style={{ background: color }}
              />
            );
          })}
          <label className="relative w-6 h-6 rounded-full overflow-hidden border border-[#d9d4cb] cursor-pointer grid place-items-center bg-white/70">
            <span className="text-[12px] leading-none text-[#8f8a80]">+</span>
            <input
              type="color"
              value={colors[cat]}
              onChange={(e) => setColor(cat, e.target.value)}
              aria-label={`Pick a custom ${LABELS[cat]} colour`}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </section>
    );
  };

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

      {/* body: 3-column layout on wide screens (LEFT menu · stage · RIGHT
          menu); stacks vertically on narrow screens (stage first, then the
          menu sections full-width below). */}
      <div className="relative z-10 flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(220px,260px)_1fr_minmax(220px,260px)] lg:gap-4 px-4 sm:px-8 pb-7">
        {/* LEFT vertical menu — Shoes + Hair */}
        <nav
          aria-label="Shoes and Hair options"
          className="order-2 lg:order-1 flex flex-col gap-6 pt-4 lg:pt-2"
        >
          {LEFT_CATEGORIES.map(renderCategorySection)}
        </nav>

        {/* CENTER 3D stage + global animation selector */}
        <main className="order-1 lg:order-2 flex flex-col min-h-[420px] lg:min-h-0">
          <div className="relative flex-1 min-h-[420px]">
            <div className="absolute inset-0">
              <WardrobeScene {...sceneProps} />
            </div>
          </div>

          {/* animation selector — global; applies to the whole avatar. */}
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span id="wardrobe-animation-label" className="text-[11px] tracking-widest uppercase text-[#a39d92]">
              Animation
            </span>
            <div
              role="radiogroup"
              aria-labelledby="wardrobe-animation-label"
              className="flex items-center gap-2 flex-wrap"
            >
              {ANIMATIONS.map(({ value, label }) => {
                const isSel = animation === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    onClick={() => setAnimation(value)}
                    aria-checked={isSel}
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
        </main>

        {/* RIGHT vertical menu — Top + Bottoms */}
        <nav
          aria-label="Top and Bottoms options"
          className="order-3 flex flex-col gap-6 pt-4 lg:pt-2"
        >
          {RIGHT_CATEGORIES.map(renderCategorySection)}
        </nav>
      </div>
    </div>
  );
}
