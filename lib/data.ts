export const stack = ["AWS", "Adobe Experience Manager", "Databricks", "Python", "Machine Learning", "Next.js"];

export type Case = {
  num: string;
  slug: string;
  title: string;
  desc: string;
  tags: string[];
  // Preview thumbnail rendered on the card (an architecture diagram).
  image: string;
  // Route to the case-study detail page with the interactive diagram.
  href: string;
  // Path to the self-contained interactive Archify diagram (opened in a new tab).
  diagram: string;
};

// Architecture case studies. Each one links to a detail page that embeds an
// interactive architecture diagram generated with Archify.
export const cases: Case[] = [
  {
    num: "01",
    slug: "content-delivery-cache",
    title: "Content Delivery & Cache Invalidation",
    desc: "An enterprise AEM edge: CDN and dispatcher caching with deferred, event-driven purge across the delivery tier.",
    tags: ["AEM", "CDN", "Caching"],
    image: "/images/case-studies/content-delivery-cache.png",
    href: "/case-studies/content-delivery-cache",
    diagram: "/diagrams/content-delivery-cache.html",
  },
  {
    num: "02",
    slug: "publishing-rollout",
    title: "Publishing & Rollout Pipeline",
    desc: "Priority replication driving Multi-Site Manager rollout, localization, metadata export, and publish notifications.",
    tags: ["AEM", "MSM", "Workflow"],
    image: "/images/case-studies/publishing-rollout.png",
    href: "/case-studies/publishing-rollout",
    diagram: "/diagrams/publishing-rollout.html",
  },
  {
    num: "03",
    slug: "metadata-sync",
    title: "Content Metadata DB Sync",
    desc: "A scheduled job scans pages and DAM assets, then batch-writes governed metadata into an external relational store.",
    tags: ["AEM", "JDBC", "Metadata"],
    image: "/images/case-studies/metadata-sync.png",
    href: "/case-studies/metadata-sync",
    diagram: "/diagrams/metadata-sync.html",
  },
  {
    num: "04",
    slug: "external-integrations",
    title: "External Service Integrations",
    desc: "An OAuth-brokered API gateway fronting product, registration, video, and search partners across trust boundaries.",
    tags: ["OAuth2", "Gateway", "SaaS"],
    image: "/images/case-studies/external-integrations.png",
    href: "/case-studies/external-integrations",
    diagram: "/diagrams/external-integrations.html",
  },
  {
    num: "05",
    slug: "s3-glacier-archiving",
    title: "Asset Archiving to AWS S3 Glacier",
    desc: "An OSGi-driven workflow that streams DAM originals to S3 Glacier, preserves searchable metadata, and restores on demand.",
    tags: ["AEM", "AWS S3", "Glacier"],
    image: "/images/case-studies/s3-glacier-archiving.png",
    href: "/case-studies/s3-glacier-archiving",
    diagram: "/diagrams/s3-glacier-archiving.html",
  },
  {
    num: "06",
    slug: "graphql-endpoint",
    title: "Universal GraphQL Endpoint in AEM",
    desc: "An OSGi service that projects DAM asset metadata into Content Fragments, exposing a cacheable, headless-ready GraphQL layer.",
    tags: ["AEM", "GraphQL", "Headless"],
    image: "/images/case-studies/graphql-endpoint.png",
    href: "/case-studies/graphql-endpoint",
    diagram: "/diagrams/graphql-endpoint.html",
  },
];

export const badges = [
  {
    abbr: "SA",
    issuer: "Amazon Web Services",
    title: "AWS Solutions Architect",
    meta: "Verified Credential · Credly",
    image: "/images/certs/aws-solutions-architect.png",
    href: "https://www.credly.com/badges/321c2213-2b96-4493-9555-ff4a8c2a5fc4",
  },
  {
    abbr: "ML",
    issuer: "Amazon Web Services",
    title: "AWS Machine Learning",
    meta: "Verified Credential · Credly",
    image: "/images/certs/aws-machine-learning.png",
    href: "https://www.credly.com/badges/e3e6b48b-7d91-4a84-9f26-014d79627aa3",
  },
  {
    abbr: "AEM",
    issuer: "Adobe",
    title: "AEM Sites Architect",
    meta: "Adobe Certified · Verified",
    image: "/images/certs/aem-sites-architect.png",
    href: "https://certification.adobe.com/credential/verify/b73fab75-a6dd-11f1-bdd6-42010a400002/linkedin",
    // The Adobe badge artwork has a solid white background, so this card is
    // rendered as a light/white card to match it (see `variant` handling in
    // app/page.tsx and the `.cert-card--light` styles in globals.css).
    variant: "light" as const,
  },
];

export const caps = [
  { name: "Cloud Architecture", code: "AWS", lx: "50%", ly: "2%" },
  { name: "Generative AI", code: "GENAI", lx: "88%", ly: "28%" },
  { name: "Data Engineering", code: "DATA", lx: "88%", ly: "72%" },
  { name: "Fabric Engineering", code: "AEM", lx: "50%", ly: "98%" },
  { name: "ML Ops", code: "MLOPS", lx: "12%", ly: "72%" },
  { name: "DAM Automation", code: "DAM", lx: "12%", ly: "28%" },
];

export type Project = {
  label: string;
  tag: string;
  title: string;
  meta: string;
  href?: string;
  image?: string;
  video?: string;
};

export const projects: Project[] = [
  {
    label: "PROJECT SHOT · Coach trainer interface",
    tag: "Fitness",
    title: "Coach Fabric Smart Fit Trainer",
    meta: "Client-side conversational gym coach with a 3D avatar",
    href: "/projects/coach-trainer",
  },
  {
    label: "PROJECT SHOT · Chatbot interface",
    tag: "GenAI",
    title: "Chef Fabric Recipe Assistant",
    meta: "Client-side conversational chef with a 3D avatar",
    href: "/projects/chef-chatbot",
  },
  {
    label: "LIVE DEMO · Interactive avatar builder",
    tag: "Next.js",
    title: "Digital Wardrobe Avatar Builder",
    meta: "Rotate a 3D model and swap garments and colors in real time",
    href: "/projects/digital-wardrobe",
    image: "/images/final_futuristic_avatar.jpg",
    video: "/videos/digital-wardrobe-preview.mp4",
  },
  {
    label: "LIVE DEMO · 3D virtual pet",
    tag: "3D",
    title: "Fabric Pet Virtual Tamagotchi",
    meta: "Feed, play with, and care for a 3D schnauzer that lives in your browser",
    href: "/projects/virtual-pet",
  },
];

export const ticker = [
  "AWS us-east-1 · nominal",
  "Fabric mesh sync · 0 backlog",
  "Bedrock latency 142ms",
  "pipeline throughput 3.2M/s",
  "model drift · within bounds",
  "IaC drift · none",
  "uptime 99.99%",
];


export function getCase(slug: string): Case {
  const found = cases.find((c) => c.slug === slug);
  if (!found) throw new Error(`Unknown case study: ${slug}`);
  return found;
}
