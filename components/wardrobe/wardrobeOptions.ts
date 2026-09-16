// ---------------------------------------------------------------------------
// Digital Wardrobe — shared option data + types (NO three.js).
//
// This lightweight module holds the RUNTIME VALUE `OPTIONS` (the UI option
// labels) and the shared TYPE declarations used by BOTH the control UI
// (components/WardrobeBuilder.tsx) and the 3D scene
// (components/wardrobe/WardrobeScene.tsx).
//
// WHY IT EXISTS: WardrobeBuilder needs OPTIONS (a value) to render its menus,
// but WardrobeScene is a three.js/@react-three/@pixiv-three-vrm-heavy module.
// If WardrobeBuilder imports OPTIONS directly FROM WardrobeScene, the bundler
// pulls WardrobeScene's entire three.js module graph into the wardrobe PAGE's
// STATIC bundle — even though WardrobeScene is only ever mounted via
// next/dynamic { ssr:false }. That is why the ~913KB three chunk was preloaded
// in the wardrobe page HTML.
//
// By keeping OPTIONS + the types HERE, importing NOTHING from three /
// @react-three / @pixiv/three-vrm, the heavy three code loads only when the
// dynamic WardrobeScene is actually mounted, not as part of the static page.
//
// This module MUST NOT import three, @react-three/*, or @pixiv/three-vrm.
// ---------------------------------------------------------------------------

export type Category = "outfit" | "bottom" | "shoes" | "hat";

// Which humanoid animation the avatar plays. "rest" means no clip is playing
// (the avatar stays in its idle rest pose while the scene auto-rotates); the
// others map to the retargeted FBX clips bundled in public/animations/.
export type WardrobeAnimation = "rest" | "idle" | "walking" | "waving";

export type WardrobeSelection = Record<Category, number>;
export type WardrobeColors = Record<Category, string>;

// Option labels shown in the UI. Index 0 is always the "Base"/"None" option:
// selecting it mounts no garment for that category, so the base body shows
// through unclothed for that slot. The order of each array is the source of
// truth for GARMENT_URLS/THUMBNAILS indices in the scene + builder.
export const OPTIONS: Record<Category, string[]> = {
  outfit: [
    "Base",
    "Tank Top",
    "Shirt",
    "Hoodie",
    "Crop Top",
    "Light Shirt",
    "Full Jacket",
    "Tucked Shirt",
    "Sweater",
  ],
  bottom: [
    "Base",
    "Cargo Pants",
    "Casual Shorts",
    "Skirt",
    "Sport Shorts",
    "Above-Knee Shorts",
    "Waist Shorts",
    "Double-Belt Pants",
  ],
  shoes: [
    "None",
    "Sneakers",
    "Short Boots",
    "Thin Shoe",
    "Dress Boots",
    "Tall Boots",
    "Tennis Shoes",
    "High Top",
  ],
  hat: [
    "None",
    "Short",
    "Ponytail",
    "Curled Bangs",
    "Buns",
    "Straight",
    "Swept",
    "Long Spike",
    "Dreds",
  ],
};

// Pure helper: given a category's CURRENT option index, return the NEXT valid
// index, wrapping around using the number of options in OPTIONS (the content
// source of truth). Used by WardrobeBuilder so a 3D garment click advances the
// SAME selection the option menus set — no garment list or wrap math lives in
// the scene. Kept here (a non-three module) so it can be shared without pulling
// the three.js scene into the static bundle.
export function nextIndex(category: Category, current: number): number {
  const len = OPTIONS[category].length;
  if (len <= 0) return current;
  return (current + 1) % len;
}
