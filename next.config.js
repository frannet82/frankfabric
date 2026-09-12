/** @type {import('next').NextConfig} */

// GitHub Pages PROJECT site is served under /<repo>/ (here: /frankfabric/).
// In production we prefix all routes/assets with that base path; in local dev
// we leave it empty so `next dev` works at the root.
// NOTE: If a custom domain (CNAME) is configured later, the site is served at
// the domain root — clear `basePath` and `assetPrefix` (set them to '') so
// assets resolve correctly.
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/frankfabric' : '';

const nextConfig = {
  reactStrictMode: true,
  // Expose the base path to client code. next/image with `unoptimized` does
  // not prefix `basePath` onto image `src`, so components that reference files
  // in public/ prepend this value manually.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Emit a fully static site into out/ for GitHub Pages.
  output: 'export',
  // The default Next.js image optimizer is unavailable in a static export,
  // and the app uses next/image, so serve images unoptimized.
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: isProd ? '/frankfabric/' : '',
  // Emit directory-style index.html files (e.g. projects/digital-wardrobe/index.html)
  // so static hosts like GitHub Pages resolve nested routes without extra config.
  trailingSlash: true,
};

module.exports = nextConfig;
