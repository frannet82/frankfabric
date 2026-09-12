# Frank Cloud Fabric

Next.js 16 + Tailwind portfolio site.

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:3000.

## Structure

- `app/page.tsx` — landing page (hero, capabilities, case studies, credentials, project gallery, contact)
- `app/projects/digital-wardrobe/page.tsx` — live interactive project page
- `components/WardrobeBuilder.tsx` — the Digital Wardrobe avatar builder (upload a photo, mix outfits)
- `lib/data.ts` — content for stack, case studies, badges, and project gallery cards

## Deployment

The site is a static export (`output: 'export'`) and deploys automatically to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(and via manual `workflow_dispatch`). It is served as a project site under the
`/frankfabric/` base path, so production builds prefix all routes and assets
with `/frankfabric`. If a custom domain (CNAME) is configured later, clear
`basePath`/`assetPrefix` in `next.config.js`.
