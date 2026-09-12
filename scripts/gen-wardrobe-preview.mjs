// Generates public/images/digital-wardrobe-preview.png — an original, offline
// preview asset that depicts the Digital Wardrobe concept: a stylized rigged
// mannequin/avatar wearing layered garments on the atelier's light background.
//
// The palette echoes FEAT-001's curated wardrobe palette for visual
// consistency with the live builder:
//   background ivory/sand   #faf9f7 / #efede8 / #e4e1da
//   terracotta accent       #a65a4b   (outfit / jacket)
//   slate                   #3f5a6b   (trousers)
//   cognac                  #8a5a3c   (shoes)
//   espresso                #2c2a26   (hat / chrome / text)
//   sage                    #5f7355
//   near-white garment      #f4f1ea
//
// Rasterized to PNG via `sharp` (already available in node_modules). No new
// deps, no runtime CDN fetches — the output is a committed static asset served
// through lib/asset.ts's asset() base-path helper.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "images", "digital-wardrobe-preview.png");

const W = 1200;
const H = 675; // 16:9 card / aspect-video

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="atelier" cx="50%" cy="16%" r="90%">
      <stop offset="0%" stop-color="#faf9f7"/>
      <stop offset="55%" stop-color="#efede8"/>
      <stop offset="100%" stop-color="#e4e1da"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e4e1da"/>
      <stop offset="100%" stop-color="#d9d3c8"/>
    </linearGradient>
    <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b56a5a"/>
      <stop offset="100%" stop-color="#a65a4b"/>
    </linearGradient>
    <linearGradient id="trousers" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#486475"/>
      <stop offset="100%" stop-color="#3f5a6b"/>
    </linearGradient>
    <radialGradient id="skin" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#f3e7dd"/>
      <stop offset="100%" stop-color="#e7d4c5"/>
    </radialGradient>
    <radialGradient id="podium" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="rgba(44,42,38,0.16)"/>
      <stop offset="100%" stop-color="rgba(44,42,38,0)"/>
    </radialGradient>
  </defs>

  <!-- Atelier backdrop -->
  <rect width="${W}" height="${H}" fill="url(#atelier)"/>
  <rect x="0" y="512" width="${W}" height="163" fill="url(#floor)"/>

  <!-- Soft studio glow behind figure -->
  <circle cx="600" cy="250" r="240" fill="#f4f1ea" opacity="0.6"/>

  <!-- Contact shadow / podium -->
  <ellipse cx="600" cy="600" rx="220" ry="34" fill="url(#podium)"/>

  <!-- ===== Avatar figure wearing garments ===== -->
  <g>
    <!-- Espresso hat / beanie on the crown -->
    <path d="M540 92 q60 -44 120 0 q6 22 -6 30 q-54 -18 -108 0 q-12 -8 -6 -30 Z" fill="#2c2a26"/>
    <rect x="536" y="118" width="128" height="16" rx="8" fill="#3a3630"/>

    <!-- Head -->
    <circle cx="600" cy="168" r="40" fill="url(#skin)"/>
    <!-- Neck -->
    <rect x="586" y="200" width="28" height="26" fill="#e7d4c5"/>

    <!-- Terracotta jacket / outfit layer over torso -->
    <path d="M512 232
             q88 -34 176 0
             l26 150
             q-26 14 -52 16
             l-8 96
             q-62 16 -108 0
             l-8 -96
             q-26 -2 -52 -16 Z" fill="url(#jacket)"/>
    <!-- Jacket lapel / opening -->
    <path d="M600 226 l-20 168 l20 30 l20 -30 Z" fill="#f4f1ea" opacity="0.85"/>
    <!-- Jacket shoulders / sleeves -->
    <path d="M512 232 q-40 12 -52 92 l30 12 q18 -70 44 -80 Z" fill="#a65a4b"/>
    <path d="M688 232 q40 12 52 92 l-30 12 q-18 -70 -44 -80 Z" fill="#a65a4b"/>
    <!-- Forearms -->
    <rect x="466" y="330" width="24" height="70" rx="12" fill="#e7d4c5"/>
    <rect x="710" y="330" width="24" height="70" rx="12" fill="#e7d4c5"/>

    <!-- Slate trousers -->
    <path d="M536 486 q64 16 128 0 l-6 150 q-30 8 -52 4 l-6 -120 l-6 120 q-22 4 -52 -4 Z" fill="url(#trousers)"/>

    <!-- Cognac shoes -->
    <path d="M508 636 q34 -10 66 4 l4 24 q-40 12 -78 2 q-2 -20 8 -30 Z" fill="#8a5a3c"/>
    <path d="M626 640 q34 -14 66 -4 q10 10 8 30 q-38 10 -78 -2 Z" fill="#8a5a3c"/>
  </g>

  <!-- ===== UI chrome hints: this is a wardrobe/dress-up builder ===== -->
  <!-- Category label chip -->
  <g>
    <rect x="60" y="60" width="196" height="40" rx="20" fill="#2c2a26"/>
    <text x="86" y="86" font-family="Georgia, 'Times New Roman', serif" font-size="19" fill="#f6f4ef" letter-spacing="1">Digital Wardrobe</text>
  </g>

  <!-- Color swatch rail (echoes the builder palette) -->
  <g>
    <circle cx="1108" cy="250" r="24" fill="#a65a4b"/>
    <circle cx="1108" cy="312" r="24" fill="#3f5a6b"/>
    <circle cx="1108" cy="374" r="24" fill="#5f7355"/>
    <circle cx="1108" cy="436" r="24" fill="#8a5a3c"/>
    <circle cx="1108" cy="498" r="24" fill="#f4f1ea" stroke="#c9c3b7" stroke-width="2"/>
  </g>

  <!-- Rotate hint -->
  <g opacity="0.7">
    <path d="M104 470 a70 70 0 1 1 30 52" fill="none" stroke="#2c2a26" stroke-width="4" stroke-linecap="round"/>
    <path d="M128 512 l14 16 l-24 6 Z" fill="#2c2a26"/>
    <text x="72" y="576" font-family="Georgia, 'Times New Roman', serif" font-size="16" fill="#6b655c">drag to rotate</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, quality: 90 })
  .toFile(OUT);

console.log("Wrote", OUT);
