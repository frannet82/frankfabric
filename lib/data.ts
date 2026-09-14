export const stack = ["AWS", "Adobe Experience Manager", "Databricks", "Python", "Machine Learning", "Next.js"];

export const cases = [
  {
    num: "01",
    title: "On-Prem to AWS Cloud Migration",
    desc: "Re-architected a legacy enterprise stack into a resilient, auto-scaling AWS environment with zero-downtime cutover.",
    tags: ["AWS", "Migration", "IaC"],
  },
  {
    num: "02",
    title: "Massive-Scale DAM Automation",
    desc: "Automated ingestion and processing of millions of digital assets in AEM with ML-driven metadata enrichment.",
    tags: ["AEM", "Automation", "ML"],
  },
  {
    num: "03",
    title: "Enterprise AI Chatbot Integration",
    desc: "Deployed a governed generative-AI assistant grounded in enterprise content with retrieval and guardrails.",
    tags: ["GenAI", "RAG", "Bedrock"],
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
    label: "PROJECT SHOT · Cloud Migration dashboard",
    tag: "AWS",
    title: "Migration Control Plane",
    meta: "Landing-zone & cost telemetry",
  },
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
