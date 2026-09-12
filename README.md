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
