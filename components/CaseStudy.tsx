import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { asset } from "@/lib/asset";
import type { Case } from "@/lib/data";

// Detail layout for an architecture case study. It embeds the self-contained,
// interactive Archify diagram (served as static HTML from public/diagrams/) in
// an iframe and links out to open it full-screen in a new tab.
//
// `highlights` are short, human-authored takeaways specific to each diagram.
export default function CaseStudy({
  study,
  intro,
  highlights,
}: {
  study: Case;
  intro: string;
  highlights: { title: string; body: string }[];
}) {
  const diagramUrl = asset(study.diagram);

  return (
    <main
      className="min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(63,169,255,0.16), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(155,107,255,0.16), transparent 56%), linear-gradient(180deg, #05060c 0%, #06071a 45%, #05060c 100%)",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-white tracking-tight">
              Frank<span className="text-cloud-mist">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#case-studies" className="text-[14px] text-white/80 hover:text-white">
            ← Back to Case Studies
          </Link>
        </nav>
      </div>

      <section className="max-w-[1180px] mx-auto px-6 pt-8 pb-4">
        <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">
          {`// Case Study ${study.num}`}
        </span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,44px)] tracking-tight text-[#f4f6fb] mt-3 mb-4">
          {study.title}
        </h1>
        <p className="text-[15.5px] leading-relaxed text-[#9aa2b4] max-w-[760px] font-light">{intro}</p>
        <div className="flex gap-2 flex-wrap mt-5">
          {study.tags.map((t) => (
            <span
              key={t}
              className="font-mono text-[11px] text-[#8b93a7] px-[10px] py-[5px] rounded-sm border border-white/10"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Interactive architecture diagram */}
      <section className="max-w-[1180px] mx-auto px-6 pt-6 pb-4">
        <div className="rounded-xl border border-white/[0.1] overflow-hidden bg-[#0a0e1a] shadow-[0_24px_70px_rgba(5,6,12,0.6)]">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
            <span className="font-mono text-[11px] tracking-widest uppercase text-[#6b8b9a]">
              Interactive Diagram · Archify
            </span>
            <a
              href={diagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-widest uppercase text-[#8b93a7] hover:text-cloud-blue whitespace-nowrap"
            >
              Open full screen ↗
            </a>
          </div>
          <iframe
            src={diagramUrl}
            title={`${study.title} — interactive architecture diagram`}
            className="w-full h-[70vh] min-h-[560px] block bg-[#0a0e1a]"
            loading="lazy"
          />
        </div>
        <p className="text-[12.5px] text-[#6b7286] font-light mt-3">
          Explore the map: switch themes, search nodes, trace routes, and play the guided views inside the frame.
        </p>
      </section>

      <section className="max-w-[1180px] mx-auto px-6 pt-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {highlights.map((h) => (
            <div
              key={h.title}
              className="relative p-6 rounded border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] backdrop-blur-md overflow-hidden"
            >
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cloud-blue to-cloud-violet" />
              <h3 className="font-display font-semibold text-[16px] text-[#f4f6fb] mb-2">{h.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-[#9198aa] font-light">{h.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
