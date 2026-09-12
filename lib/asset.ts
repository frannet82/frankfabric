// Resolve a public/ asset path so it carries the deployment base path.
//
// This site is exported statically and served from a project-scoped base path
// on GitHub Pages (/frankfabric/ in production, empty in local dev). Next
// rewrites routing hrefs automatically, but because next/image runs with
// `images: { unoptimized: true }` it does NOT prefix `basePath` onto image
// `src`. So every next/image `src` that points at a file in public/ must
// prepend the base path by hand.
//
// Route all such references through this single helper so the codebase has one
// convention: `asset("/images/foo.png")` -> "/frankfabric/images/foo.png" in
// production, "/images/foo.png" in dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}
