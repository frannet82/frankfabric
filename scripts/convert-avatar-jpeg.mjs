// Re-encodes public/images/final_futuristic_avatar.png into a correctly-named
// and correctly-encoded public/images/final_futuristic_avatar.jpg.
//
// The source file carries a .png extension but its bytes are already JPEG
// (a real 1024x1024 render of the 3D avatar). Shipping it under a .png name
// mislabels the container's Content-Type. This script decodes the pixels via
// `sharp` (already available in node_modules) and writes a genuine JPEG with a
// matching extension so the wardrobe card preview is served as image/jpeg.
//
// No new deps, no runtime CDN fetches — the output is a committed static asset
// served offline through lib/asset.ts's asset() base-path helper.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "public", "images", "final_futuristic_avatar.png");
const OUT = join(__dirname, "..", "public", "images", "final_futuristic_avatar.jpg");

await sharp(SRC)
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(OUT);

console.log("Wrote", OUT);
