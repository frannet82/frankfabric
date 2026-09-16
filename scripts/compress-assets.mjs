// compress-assets.mjs — repeatable asset compressor for the frankfabric VRMs
// and any other embedded-texture GLBs.
//
// WHAT IT DOES
//   Shrinks the weight of every drophunter avatar/garment VRM
//   (public/models/characters/drophunter/**) and any other GLB/VRM with
//   EMBEDDED textures under public/models/** by re-encoding those textures:
//   each image is decoded, resized to a sane per-material
//   cap, and re-encoded as WebP. Nothing else in the file is touched —
//   geometry, morph targets, skeletons and every VRM extension (VRMC_vrm,
//   VRMC_springBone, VRMC_materials_mtoon, KHR_materials_unlit,
//   KHR_texture_transform, ...) survive byte-for-byte.
//
// WHY A CHUNK-LEVEL REWRITE (and not gltf-transform's NodeIO)
//   gltf-transform's default IO does not know the VRM extensions and SILENTLY
//   DROPS them on write, which turns a VRM back into a plain glTF (MToon,
//   spring bones all break). So instead of a round-trip we rewrite the GLB
//   container by hand: parse the 12-byte header, the JSON chunk (0x4E4F534A)
//   and the BIN chunk (0x004E4942); re-encode only the bufferViews that images
//   point at; rebuild the BIN chunk with 4-byte alignment; patch
//   bufferViews[].byteOffset/byteLength and images[].mimeType; recompute the
//   chunk and total lengths. Texture bytes are the bulk of every VRM, so a
//   texture-only pass already hits the weight target.
//
// WHY WEBP AND NOT KTX2/Basis
//   frankfabric tints materials via material.color.copy() on MToon
//   (three-vrm) / MeshStandard materials — there is NO canvas getImageData
//   pixel-readback tint pipeline here (that existed only in the tireshop
//   reference). three's GLTFLoader decodes image/webp natively, so WebP needs
//   NO runtime decoder and is safe for every texture. No new dependency, no
//   KTX2/Basis/Draco/meshopt runtime wiring is introduced.
//
// SOURCE OF TRUTH  (so the script is re-runnable and never recompresses its
//                   own output)
//   Reads from assets-src/models/** (pristine originals) and writes to
//   public/models/**. On the very first run, if assets-src/ does not yet exist,
//   it is seeded from the current public/models/ (assumed pristine) before any
//   compression happens. Pass --src <dir> to read from a different source tree.
//
// USAGE
//   node scripts/compress-assets.mjs                 # src=assets-src/models, out=public/models
//   node scripts/compress-assets.mjs --src some/dir  # read originals from some/dir
//   node scripts/compress-assets.mjs --out other/dir # write compressed copies elsewhere
//   node scripts/compress-assets.mjs --dry-run       # report sizes, write nothing
//
// It is safe to run repeatedly: it always reads the untouched source tree, so
// output never feeds back into input.

import { readFile, writeFile, mkdir, cp, stat, readdir } from 'node:fs/promises';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const args = new Map();
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--dry-run') args.set('dry-run', true);
  else if (a.startsWith('--')) args.set(a.slice(2), argv[++i]);
}
const SRC = join(ROOT, args.get('src') || 'assets-src/models');
const OUT = join(ROOT, args.get('out') || 'public/models');
const DRY = args.has('dry-run');
const PUBLIC_MODELS = join(ROOT, 'public/models');

// ---- glTF binary container helpers ----------------------------------------
const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_TYPE = 0x4e4f534a; // 'JSON'
const BIN_TYPE = 0x004e4942; // 'BIN\0'

/** Parse a .glb/.vrm buffer into { json, bin }. */
function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB (bad magic)');
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);

  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    const chunk = buf.subarray(start, start + len);
    if (type === JSON_TYPE) json = JSON.parse(Buffer.from(chunk).toString('utf8'));
    else if (type === BIN_TYPE) bin = Buffer.from(chunk);
    off = start + len;
  }
  if (!json) throw new Error('no JSON chunk');
  return { json, bin };
}

/** Pad a buffer to a 4-byte boundary with `fill` bytes. */
function pad4(buf, fill) {
  const rem = buf.length % 4;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, fill)]);
}

/** Serialise { json, bin } back into a GLB buffer. */
function serializeGlb(json, bin) {
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20); // pad with spaces
  const binBuf = bin ? pad4(bin, 0x00) : null;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);

  const parts = [header];
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(JSON_TYPE, 4);
  parts.push(jsonHeader, jsonBuf);

  if (binBuf) {
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binBuf.length, 0);
    binHeader.writeUInt32LE(BIN_TYPE, 4);
    parts.push(binHeader, binBuf);
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  header.writeUInt32LE(total, 8);
  return Buffer.concat(parts);
}

// ---- per-texture policy ----------------------------------------------------
// Face/skin/eyes/mouth textures carry facial detail (and, in frankfabric, are
// the maps material.color tints), so they stay at a higher resolution and
// quality. Everything else (hair, garments, props) can be more
// aggressive. Match is by the glTF image `name`, case-insensitive. The
// drophunter maps are named e.g. "..._skin_BaseColor", "..._Face_BaseColor",
// "..._eyes_BaseColor", "..._mouth_BaseColor", "..._skin_Normal".
const CONSERVATIVE = /(_face_|_skin_|_eyes_|_mouth_)/i;
// Normal maps must not be re-encoded lossy in a way that mangles their vectors;
// keep them larger and near-lossless.
const NORMAL_MAP = /_normal/i;

const POLICY = {
  conservative: { max: 1536, quality: 90 },
  normal: { max: 1536, quality: 95 },
  standard: { max: 1024, quality: 82 },
};

// Textures smaller than this on both sides are left untouched: tiny lookup or
// solid-colour maps (16x16, 32x32) cost almost nothing and resizing risks
// artefacts.
const MIN_SIZE = 64;

function policyFor(imageName) {
  const name = imageName || '';
  if (NORMAL_MAP.test(name)) return POLICY.normal;
  if (CONSERVATIVE.test(name)) return POLICY.conservative;
  return POLICY.standard;
}

// ---- core: re-encode the image bufferViews in place ------------------------
async function compressGlb(buf, label) {
  const { json, bin } = parseGlb(buf);
  if (!bin) return { buf, changed: false, note: 'no BIN chunk' };
  const images = json.images || [];
  if (!images.length) return { buf, changed: false, note: 'no images' };

  // Guard: an image bufferView must not be shared with an accessor (it never is
  // in these assets, but rewriting one that is would corrupt geometry).
  const accessorBVs = new Set(
    (json.accessors || []).map((a) => a.bufferView).filter((x) => x !== undefined),
  );

  // Re-encode each image, collect its new bytes. Keep the ORIGINAL bufferView
  // layout order to rebuild the BIN chunk deterministically.
  const newImageBytes = new Map(); // bufferView index -> Buffer
  let anyChanged = false;

  for (const img of images) {
    const bvIndex = img.bufferView;
    if (bvIndex === undefined) continue; // external/URI image (none here)
    if (accessorBVs.has(bvIndex)) {
      throw new Error(`image bufferView ${bvIndex} is shared with an accessor — refusing`);
    }
    const bv = json.bufferViews[bvIndex];
    const src = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);

    let meta;
    try {
      meta = await sharp(src).metadata();
    } catch {
      // Not a decodable image (shouldn't happen) — leave it as-is.
      newImageBytes.set(bvIndex, Buffer.from(src));
      continue;
    }

    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w < MIN_SIZE && h < MIN_SIZE) {
      newImageBytes.set(bvIndex, Buffer.from(src));
      continue;
    }

    const pol = policyFor(img.name);
    let pipeline = sharp(src);
    if (Math.max(w, h) > pol.max) {
      pipeline = pipeline.resize({
        width: w >= h ? pol.max : null,
        height: h > w ? pol.max : null,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    const encoded = await pipeline.webp({ quality: pol.quality, effort: 6 }).toBuffer();

    // Only adopt the WebP if it is actually smaller; otherwise keep the source
    // bytes (some tiny PNGs beat WebP).
    if (encoded.length < src.length) {
      newImageBytes.set(bvIndex, encoded);
      img.mimeType = 'image/webp';
      anyChanged = true;
    } else {
      newImageBytes.set(bvIndex, Buffer.from(src));
    }
  }

  if (!anyChanged) return { buf, changed: false, note: 'no size win' };

  // Rebuild the BIN chunk. Walk every bufferView in byteOffset order, copying
  // non-image views verbatim and swapping image views for their new bytes, each
  // aligned to 4 bytes. Patch byteOffset/byteLength as we go.
  const bvs = json.bufferViews.map((bv, i) => ({ i, bv }));
  bvs.sort((a, b) => (a.bv.byteOffset || 0) - (b.bv.byteOffset || 0));

  const pieces = [];
  let cursor = 0;
  for (const { i, bv } of bvs) {
    const replacement = newImageBytes.get(i);
    const data = replacement
      ? replacement
      : bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    bv.byteOffset = cursor;
    bv.byteLength = data.length;
    pieces.push(data);
    cursor += data.length;
    const rem = cursor % 4;
    if (rem !== 0) {
      const padLen = 4 - rem;
      pieces.push(Buffer.alloc(padLen, 0x00));
      cursor += padLen;
    }
  }

  const newBin = Buffer.concat(pieces);
  // The glTF spec allows the declared buffer byteLength to omit trailing chunk
  // padding; keep it in sync with the real data length.
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = newBin.length;

  const out = serializeGlb(json, newBin);
  return { buf: out, changed: true, note: label };
}

// ---- walk the trees --------------------------------------------------------
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isAsset(path) {
  return /\.(vrm|glb)$/i.test(path);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Seed the source-of-truth tree from the current (pristine) public/models on
  // first run so subsequent runs read originals, never compressed output.
  if (!(await exists(SRC))) {
    console.log(`source tree ${relative(ROOT, SRC)} missing — seeding from public/models`);
    if (!DRY) {
      await mkdir(dirname(SRC), { recursive: true });
      await cp(PUBLIC_MODELS, SRC, { recursive: true });
    }
  }

  const files = [];
  for await (const f of walk(SRC)) if (isAsset(f)) files.push(f);
  files.sort();

  if (!files.length) {
    console.error(`no .vrm/.glb assets found under ${SRC}`);
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  console.log(
    `compressing ${files.length} assets: ${relative(ROOT, SRC)} -> ${relative(ROOT, OUT)}\n`,
  );

  for (const srcPath of files) {
    const rel = relative(SRC, srcPath);
    const outPath = join(OUT, rel);
    const input = await readFile(srcPath);
    let result;
    try {
      result = await compressGlb(input, basename(srcPath));
    } catch (err) {
      console.error(`  ! ${rel}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    const before = input.length;
    const after = result.buf.length;
    totalBefore += before;
    totalAfter += after;
    const pct = before ? Math.round((1 - after / before) * 100) : 0;
    const tag = result.changed
      ? `${(before / 1e6).toFixed(2)}MB -> ${(after / 1e6).toFixed(2)}MB (-${pct}%)`
      : `unchanged (${result.note})`;
    console.log(`  ${rel.padEnd(48)} ${tag}`);
    if (!DRY) {
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, result.buf);
    }
  }

  console.log(
    `\ntotal: ${(totalBefore / 1e6).toFixed(2)}MB -> ${(totalAfter / 1e6).toFixed(2)}MB` +
      ` (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)${DRY ? '  [dry-run: nothing written]' : ''}`,
  );
}

main();
