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
  { abbr: "SA", issuer: "Amazon Web Services", title: "AWS Solutions Architect", meta: "Professional · Verified Credential" },
  { abbr: "ML", issuer: "Amazon Web Services", title: "AWS Machine Learning Engineer", meta: "Associate · Verified Credential" },
  { abbr: "DE", issuer: "Amazon Web Services", title: "AWS Data Engineer", meta: "Associate · Verified Credential" },
  { abbr: "AEM", issuer: "Adobe", title: "Master AEM Architect", meta: "Adobe Certified Expert · Verified" },
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
};

export const projects: Project[] = [
  {
    label: "PROJECT SHOT · Cloud Migration dashboard",
    tag: "AWS",
    title: "Migration Control Plane",
    meta: "Landing-zone & cost telemetry",
  },
  {
    label: "PROJECT SHOT · DAM pipeline UI",
    tag: "AEM",
    title: "Asset Automation Console",
    meta: "ML metadata enrichment at scale",
  },
  {
    label: "PROJECT SHOT · Chatbot interface",
    tag: "GenAI",
    title: "Grounded AI Assistant",
    meta: "Retrieval + guardrails on Bedrock",
  },
  {
    label: "LIVE DEMO · Interactive avatar builder",
    tag: "Next.js",
    title: "Digital Wardrobe Avatar Builder",
    meta: "Upload a photo, style a full outfit in real time",
    href: "/projects/digital-wardrobe",
    image: "/images/mannequin_placeholder.png",
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
