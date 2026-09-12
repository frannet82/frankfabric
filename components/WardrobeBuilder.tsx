"use client";

import Image from "next/image";
import { useState, useRef } from "react";

// ---------------------------------------------------------------------------
// Digital Wardrobe — the mannequin is assembled from pre-rendered, aligned
// body-part layers (public/images/mannequin/*). Each wardrobe choice swaps the
// image used for that layer; the layers are stacked in a fixed frame so they
// always line up. The torso layer encodes BOTH the top and the outerwear,
// because long-sleeve outerwear is rendered over the shirt.
// ---------------------------------------------------------------------------

const M = "/images/mannequin";
const FRAME_W = 774;
const FRAME_H = 2141;

type Choice = { name: string; img?: string };

const TOPS: Choice[] = [
  { name: "None" },
  { name: "White Tee", img: `${M}/torso_tshirt.png` },
  { name: "Red Flannel", img: `${M}/torso_flannel.png` },
];
const BOTTOMS: Choice[] = [
  { name: "None", img: `${M}/legs_bare.png` },
  { name: "Blue Jeans", img: `${M}/legs_jeans.png` },
  { name: "Black Cargo", img: `${M}/legs_cargo.png` },
];
const SHOES: Choice[] = [
  { name: "None", img: `${M}/feet_bare.png` },
  { name: "White Sneakers", img: `${M}/feet_sneakers.png` },
  { name: "Brown Boots", img: `${M}/feet_boots.png` },
];
const OUTERWEAR: Choice[] = [
  { name: "None" },
  { name: "Leather Jacket" },
  { name: "Trench Coat" },
];
const HATS: Choice[] = [
  { name: "None", img: `${M}/head_bare.png` },
  { name: "Red Cap", img: `${M}/head_cap.png` },
  { name: "Wool Fedora", img: `${M}/head_fedora.png` },
];
const ACCESSORIES: Choice[] = [
  { name: "None", img: `${M}/arms_bare.png` },
  { name: "Silver Watch", img: `${M}/arms_watch.png` },
];

const ORDER = ["tops", "bottoms", "shoes", "outerwear", "hats", "accessories"] as const;
type Category = (typeof ORDER)[number];
const LABELS: Record<Category, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
  outerwear: "Outerwear",
  hats: "Hats",
  accessories: "Accessories",
};
const DATA: Record<Category, Choice[]> = {
  tops: TOPS,
  bottoms: BOTTOMS,
  shoes: SHOES,
  outerwear: OUTERWEAR,
  hats: HATS,
  accessories: ACCESSORIES,
};

// Thumbnail for the category buttons (a representative crop of each layer).
const THUMB: Record<Category, string> = {
  tops: `${M}/torso_tshirt.png`,
  bottoms: `${M}/legs_jeans.png`,
  shoes: `${M}/feet_sneakers.png`,
  outerwear: `${M}/torso_tshirt_jacket.png`,
  hats: `${M}/head_cap.png`,
  accessories: `${M}/arms_watch.png`,
};

export default function WardrobeBuilder() {
  const catScrollRef = useRef<HTMLDivElement>(null);
  const scrollCats = (dir: number) =>
    catScrollRef.current?.scrollBy({ left: dir * 140, behavior: "smooth" });

  const [active, setActive] = useState<Category>("tops");
  const [sel, setSel] = useState<Record<Category, number>>({
    tops: 1,
    bottoms: 1,
    shoes: 1,
    outerwear: 0,
    hats: 1,
    accessories: 0,
  });

  const cur = (c: Category) => DATA[c][sel[c]];
  const step = (dir: number) => {
    const arr = DATA[active];
    setSel((s) => ({ ...s, [active]: (s[active] + dir + arr.length) % arr.length }));
  };

  // Resolve the composite torso layer from top + outerwear selection.
  const topIdx = sel.tops; // 0 none, 1 tshirt, 2 flannel
  const outIdx = sel.outerwear; // 0 none, 1 jacket, 2 trench
  const topKey = topIdx === 1 ? "tshirt" : topIdx === 2 ? "flannel" : "none";
  const outKey = outIdx === 1 ? "jacket" : outIdx === 2 ? "trench" : "none";
  const torsoLayer = (() => {
    if (outKey === "none") {
      if (topKey === "none") return `${M}/torso_bare.png`;
      return `${M}/torso_${topKey}.png`;
    }
    // outerwear worn — needs a shirt underneath; default to tee if none picked
    const base = topKey === "none" ? "tshirt" : topKey;
    return `${M}/torso_${base}_${outKey}.png`;
  })();

  const armsLayer = ACCESSORIES[sel.accessories].img!;
  const legsLayer = BOTTOMS[sel.bottoms].img!;
  const feetLayer = SHOES[sel.shoes].img!;
  const headLayer = HATS[sel.hats].img!;

  // Stack order (back to front): head (tucked under collar), arms, feet,
  // legs (in front of feet), torso (in front of head, arms and legs).
  const layers: { src: string; z: number; alt: string }[] = [
    { src: headLayer, z: 1, alt: "head" },
    { src: armsLayer, z: 2, alt: "arms" },
    { src: feetLayer, z: 3, alt: "feet" },
    { src: legsLayer, z: 4, alt: "legs" },
    { src: torsoLayer, z: 5, alt: "torso" },
  ];

  const btnStyle = (k: Category) => {
    const isActive = active === k;
    return [
      "flex flex-col items-center gap-[7px] flex-none w-[92px] px-[6px] pt-[9px] pb-[10px] rounded-2xl cursor-pointer transition-all duration-150 border",
      isActive ? "bg-[#2c2a26] text-[#f6f4ef] border-[#2c2a26]" : "bg-white/70 text-[#4a463f] border-[#e2ded6]",
    ].join(" ");
  };

  return (
    <div
      className="relative w-full flex flex-col overflow-hidden rounded-3xl"
      style={{
        minHeight: 760,
        fontFamily: "Jost, sans-serif",
        color: "#2c2a26",
        background: "radial-gradient(120% 90% at 50% 0%,#faf9f7 0%,#efede8 55%,#e4e1da 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute left-[5%] top-[18%] w-[16%] h-[60%] border border-[#dcd8d0] rounded-md bg-gradient-to-b from-[#f6f5f2] to-[#eeece7]" />
        <div className="absolute right-[5%] top-[18%] w-[16%] h-[60%] border border-[#dcd8d0] rounded-md bg-gradient-to-b from-[#f6f5f2] to-[#eeece7]" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 flex-wrap">
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-2xl font-semibold tracking-widest leading-none">
            ATELIER
          </div>
          <div className="text-[11px] tracking-[4px] uppercase text-[#8f8a80] mt-[2px]">
            Digital Wardrobe · by Frank Cloud Fabric
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center gap-3 sm:gap-8 px-3 sm:px-8 py-4">
        <button
          onClick={() => step(-1)}
          aria-label="Previous"
          className="flex-none w-[52px] h-[52px] rounded-full border border-[#dcd8d0] bg-white/65 backdrop-blur-sm hover:bg-white hover:border-[#bcb7ac] grid place-items-center"
        >
          <span className="w-3 h-3 border-l-2 border-b-2 border-[#4a463f] rotate-45 ml-1" />
        </button>

        <div
          className="relative flex-none"
          style={{ height: "clamp(380px, 58vh, 540px)", aspectRatio: `${FRAME_W} / ${FRAME_H}` }}
        >
          {layers.map((l) => (
            <Image
              key={l.alt}
              src={l.src}
              alt={l.alt}
              fill
              sizes="240px"
              className="object-contain select-none pointer-events-none"
              style={{ zIndex: l.z }}
              priority
            />
          ))}
        </div>

        <button
          onClick={() => step(1)}
          aria-label="Next"
          className="flex-none w-[52px] h-[52px] rounded-full border border-[#dcd8d0] bg-white/65 backdrop-blur-sm hover:bg-white hover:border-[#bcb7ac] grid place-items-center"
        >
          <span className="w-3 h-3 border-r-2 border-t-2 border-[#4a463f] rotate-45 mr-1" />
        </button>
      </main>

      {/* current selection */}
      <div className="relative z-10 flex justify-center px-4 pb-2">
        <div className="flex items-center gap-[10px] bg-white/70 border border-[#e2ded6] rounded-full px-[18px] py-2">
          <span className="text-[11px] tracking-widest uppercase text-[#a39d92]">{LABELS[active]}</span>
          <span className="w-1 h-1 rounded-full" style={{ background: "#b2645f" }} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-[19px] font-semibold">
            {cur(active).name}
          </span>
        </div>
      </div>

      {/* category bar */}
      <footer className="relative z-10 px-2 sm:px-8 pb-6 pt-2">
        <div className="relative flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => scrollCats(-1)}
            aria-label="Scroll categories left"
            className="sm:hidden flex-none w-8 h-8 rounded-full border border-[#dcd8d0] bg-white/80 backdrop-blur-sm grid place-items-center active:bg-white"
          >
            <span className="w-2 h-2 border-l-2 border-b-2 border-[#4a463f] rotate-45 ml-[3px]" />
          </button>

          <div
            ref={catScrollRef}
            className="flex gap-2 sm:justify-center overflow-x-auto p-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1"
          >
            {ORDER.map((k) => (
              <button key={k} onClick={() => setActive(k)} className={btnStyle(k)}>
                <div className="relative w-12 h-11 rounded-xl bg-[#f4f1ec] border border-[#e3ded5] overflow-hidden flex-none">
                  <Image src={THUMB[k]} alt={LABELS[k]} fill sizes="48px" className="object-cover scale-[1.6]" style={{ objectPosition: "center 20%" }} />
                </div>
                <span className="text-xs tracking-wide leading-none">{LABELS[k]}</span>
                <span className="text-[10px] text-[#a39d92] whitespace-nowrap max-w-[86px] overflow-hidden text-ellipsis">
                  {cur(k).name}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollCats(1)}
            aria-label="Scroll categories right"
            className="sm:hidden flex-none w-8 h-8 rounded-full border border-[#dcd8d0] bg-white/80 backdrop-blur-sm grid place-items-center active:bg-white"
          >
            <span className="w-2 h-2 border-r-2 border-t-2 border-[#4a463f] rotate-45 mr-[3px]" />
          </button>
        </div>
      </footer>
    </div>
  );
}
