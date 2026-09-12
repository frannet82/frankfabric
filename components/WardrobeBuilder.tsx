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
} from "@/components/wardrobe/WardrobeScene";

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

// Curated swatches per category.
const SWATCHES: Record<Category, string[]> = {
  outfit: ["#e9e6df", "#b2645f", "#3b556e", "#2c2a26", "#6d7f5b"],
  bottom: ["#3f5266", "#2c2a26", "#8a6d4b", "#9aa0a6", "#5a4a52"],
  shoes: ["#f2efe9", "#2c2a26", "#7a4a2b", "#b2645f"],
  hat: ["#b2645f", "#2c2a26", "#e9e6df", "#3b556e"],
};

export default function WardrobeBuilder() {
  const [active, setActive] = useState<Category>("outfit");
  const [selection, setSelection] = useState<WardrobeSelection>({
    outfit: 0,
    bottom: 1,
    shoes: 1,
    hat: 0,
  });
  const [colors, setColors] = useState<WardrobeColors>({
    outfit: "#b2645f",
    bottom: "#3f5266",
    shoes: "#f2efe9",
    hat: "#2c2a26",
  });

  const setOption = (cat: Category, idx: number) =>
    setSelection((s) => ({ ...s, [cat]: idx }));
  const setColor = (cat: Category, color: string) =>
    setColors((c) => ({ ...c, [cat]: color }));

  const sceneProps = useMemo(() => ({ selection, colors }), [selection, colors]);

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

        {/* option buttons for the active category */}
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {OPTIONS[active].map((name, idx) => {
            const isSel = selection[active] === idx;
            return (
              <button
                key={name}
                onClick={() => setOption(active, idx)}
                className={[
                  "px-4 py-2 rounded-2xl text-sm transition-all duration-150 border",
                  isSel
                    ? "bg-[#b2645f] text-white border-[#b2645f]"
                    : "bg-white/70 text-[#4a463f] border-[#e2ded6] hover:border-[#bcb7ac]",
                ].join(" ")}
              >
                {name}
              </button>
            );
          })}
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
