import Image from "next/image";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { stack, cases, badges, caps, projects, ticker } from "@/lib/data";
import { asset } from "@/lib/asset";

export default function Home() {
  const stackLoop = [...stack, ...stack];
  const tickerLoop = [...ticker, ...ticker];

  return (
    <main
      className="min-h-screen overflow-x-hidden relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(63,169,255,0.28), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(155,107,255,0.28), transparent 56%), radial-gradient(820px 640px at 56% 114%, rgba(95,242,223,0.16), transparent 58%), linear-gradient(180deg, #05060c 0%, #06071a 45%, #05060c 100%)",
      }}
    >
      {/* HUD overlay */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(63,169,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(63,169,255,0.028) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="fixed left-0 right-0 top-0 h-[2px] z-40 pointer-events-none bg-gradient-to-r from-transparent via-cloud-blue/35 to-transparent animate-scan" />

      {/* STATUS TICKER */}
      <section className="relative z-10 border-b border-white/[0.06] bg-black/30 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-10 py-2 flex items-center gap-5 font-mono text-[11px] tracking-widest text-[#6b8b9a]">
          <span className="inline-flex items-center gap-[7px] text-cloud-blue whitespace-nowrap">
            <span className="w-[6px] h-[6px] rounded-full bg-cloud-blue shadow-[0_0_8px_#3fa9ff] animate-emberPulse" />
            SYS.ONLINE
          </span>
          <span className="opacity-60">{"//"}</span>
          <div className="flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            <div className="flex gap-9 w-max animate-ticker whitespace-nowrap">
              {tickerLoop.map((t, i) => (
                <span key={i} className="opacity-70">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <span className="whitespace-nowrap opacity-70">LAT 40.71 · LON -74.00</span>
        </div>
      </section>

      {/* HERO */}
      <section className="max-w-[1360px] mx-auto mt-5 mb-14 px-6">
        <div
          className="relative rounded-3xl overflow-hidden min-h-[660px]"
          style={{
            background:
              "radial-gradient(58% 55% at 64% 26%, rgba(60,60,150,0.45), transparent 62%), linear-gradient(120deg, #0a0e26 0%, #10184a 40%, #1a2a6c 70%, #0f1030 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: "radial-gradient(46% 40% at 24% 82%, rgba(40,80,150,0.30), transparent 62%)",
            }}
          />

          <div className="absolute right-0 bottom-0 top-0 w-[56%]">
            <Image
              src={asset("/images/final_futuristic_avatar.jpg")}
              alt="Frank portrait"
              fill
              className="object-cover"
              style={{ objectPosition: "56% 6%" }}
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(90deg, #10184a 0%, rgba(16,24,74,0.75) 16%, transparent 42%)",
              }}
            />
          </div>

          {/* nav */}
          <div className="relative z-10 px-6 pt-5">
            <nav className="flex items-center justify-between gap-6 py-3 pl-6 pr-3 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md">
              <div className="flex items-center gap-3">
                <BrandMark />
                <span className="font-display font-semibold text-[17px] text-white tracking-tight">
                  Frank<span className="text-cloud-mist">.</span>CloudFabric
                </span>
              </div>
              <div className="hidden md:flex items-center gap-8 text-[14.5px] text-white/80">
                <a href="#case-studies" className="hover:text-white">Case Studies</a>
                <a href="#capabilities" className="hover:text-white">Capabilities</a>
                <a href="#credentials" className="hover:text-white">Credentials</a>
                <a href="#projects" className="hover:text-white">Projects</a>
              </div>
              <a
                href="#contact"
                className="text-[#0d1030] bg-white px-6 py-[11px] rounded-full font-semibold text-[14.5px] hover:-translate-y-0.5 transition-transform"
              >
                Start a Project
              </a>
            </nav>
          </div>

          {/* content */}
          <div className="relative z-10 max-w-[600px] px-8 sm:px-14 pt-10 pb-12">
            <div className="flex items-center gap-3 mb-6 font-mono text-[12.5px] tracking-[2px] uppercase text-white/90">
              <span className="w-[13px] h-[13px] bg-gradient-to-br from-cloud-mist to-white rotate-45 shadow-[0_0_12px_rgba(95,242,223,0.7)]" />
              Woven for the Enterprise
            </div>
            <h1 className="font-display font-bold text-[clamp(42px,5vw,72px)] leading-[1.0] tracking-tighter mb-6 text-white">
              Where Enterprise AEM &amp; AWS&nbsp;Cloud
              <br />
              <span className="bg-gradient-to-r from-[#c9e0ff] via-[#d6c6ff] to-[#c6f2ec] bg-clip-text text-transparent">
                Meet Generative&nbsp;AI.
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-white/80 max-w-[460px] mb-8 font-light">
              Frank Cloud Fabric designs resilient, massive-scale cloud architectures where enterprise content,
              machine learning, and generative intelligence converge.
            </p>
            <div className="mb-10">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 bg-white text-[#0d1030] px-8 py-[15px] rounded-full font-semibold text-[15px] hover:-translate-y-0.5 hover:shadow-2xl transition-all"
              >
                Get started →
              </a>
            </div>
            <div className="flex items-center gap-9">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-3xl text-white">4×</span>
                <span className="text-[13px] leading-tight text-white/75">
                  AWS &amp; Adobe
                  <br />
                  Certified
                </span>
              </div>
              <div className="w-px h-[34px] bg-white/25" />
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-3xl text-white">12+</span>
                <span className="text-[13px] leading-tight text-white/75">
                  Years in
                  <br />
                  Architecture
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STACK MARQUEE */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] py-6 overflow-hidden relative z-10">
        <div className="max-w-[1280px] mx-auto mb-4 px-10">
          <span className="font-mono text-[11.5px] tracking-[2px] uppercase text-[#6b7286]">
            Core Stack &amp; Platforms
          </span>
        </div>
        <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="flex gap-[72px] w-max animate-marquee items-center px-9">
            {stackLoop.map((tech, i) => (
              <span
                key={i}
                className="font-display font-medium text-[22px] text-[#8b93a7] tracking-wide whitespace-nowrap opacity-75"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="capabilities" className="relative max-w-[1280px] mx-auto px-10 pt-24 pb-20 z-10">
        <div className="text-center max-w-[620px] mx-auto mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="h-[10px] w-12 bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// Capabilities"}
            </span>
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-[#f4f6fb]">
            Key Features &amp; Services
          </h2>
        </div>

        <div className="relative w-full max-w-[600px] aspect-square mx-auto">
          <div
            className="absolute inset-[18%] rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(63,169,255,0.30), rgba(155,107,255,0.16) 48%, transparent 70%)",
            }}
          />
          <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="cap" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3fa9ff" />
                <stop offset="1" stopColor="#9b6bff" />
              </linearGradient>
            </defs>
            <g stroke="url(#cap)" strokeWidth="1" opacity="0.5" strokeDasharray="3 6">
              {caps.map((c, i) => {
                const angle = (i / caps.length) * Math.PI * 2 - Math.PI / 2;
                const x = 200 + Math.cos(angle) * 150;
                const y = 200 + Math.sin(angle) * 150;
                return <line key={i} x1="200" y1="200" x2={x} y2={y} />;
              })}
            </g>
            <circle
              cx="200"
              cy="200"
              r="150"
              fill="none"
              stroke="url(#cap)"
              strokeWidth="1.5"
              strokeDasharray="2 12"
              opacity="0.55"
              className="origin-center animate-ringSpin"
            />
            <circle cx="200" cy="200" r="120" fill="none" stroke="url(#cap)" strokeWidth="1" strokeDasharray="1 9" opacity="0.35" />
          </svg>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] p-[2px]"
            style={{
              aspectRatio: "1/1.08",
              clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
              background: "linear-gradient(150deg,#3fa9ff,#9b6bff)",
              filter: "drop-shadow(0 0 26px rgba(63,169,255,0.45))",
            }}
          >
            <div
              className="w-full h-full grid place-items-center text-center gap-[2px]"
              style={{
                clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
                background: "radial-gradient(circle at 50% 40%, #101826, #060810)",
              }}
            >
              <div>
                <div className="font-display font-bold text-xl bg-gradient-to-br from-cloud-mist to-cloud-violet bg-clip-text text-transparent">
                  FABRIC
                </div>
                <div className="font-mono text-[9px] tracking-widest text-[#6b8b9a]">CLOUD.MESH</div>
              </div>
            </div>
          </div>
          {caps.map((c, i) => (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-[9px] w-[120px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: c.lx, top: c.ly }}
            >
              <div className="w-[58px] h-[58px] rounded-full grid place-items-center bg-black/90 border border-cloud-blue/40 shadow-[0_0_20px_rgba(63,169,255,0.18)] backdrop-blur-sm">
                <div className="w-4 h-4 rounded-[3px] bg-gradient-to-br from-cloud-blue to-cloud-violet shadow-[0_0_12px_rgba(63,169,255,0.5)] rotate-45" />
              </div>
              <div className="text-center">
                <div className="font-display font-semibold text-[13.5px] text-[#e8eaf0] leading-tight">{c.name}</div>
                <div className="font-mono text-[10px] tracking-widest text-[#5c6b8a] mt-[2px]">{c.code}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CASE STUDIES */}
      <section id="case-studies" className="relative max-w-[1280px] mx-auto px-10 pt-24 pb-20 z-10">
        <div className="max-w-[640px] mb-12">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// Selected Work"}
            </span>
            <span className="flex-1 h-[10px] bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-[#f4f6fb]">
            Architecture Case Studies
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div
              key={c.num}
              className="group relative p-7 rounded border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] backdrop-blur-md overflow-hidden transition-all hover:border-cloud-blue/55 hover:shadow-[0_0_0_1px_rgba(63,169,255,0.3),0_24px_70px_rgba(155,107,255,0.22)] hover:-translate-y-1"
            >
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cloud-blue to-cloud-violet" />
              <span className="absolute top-[10px] right-[10px] w-3 h-3 border-r border-t border-cloud-blue/50" />
              <span className="absolute bottom-[10px] left-[10px] w-3 h-3 border-l border-b border-cloud-blue/50" />
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-xs text-cloud-blue">{c.num}</span>
                <span className="font-mono text-[10px] tracking-widest text-[#5c6b68]">CASE_STUDY</span>
              </div>
              <div className="w-[46px] h-[46px] rounded grid place-items-center bg-cloud-blue/10 border border-cloud-blue/20 mb-5">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-cloud-blue to-cloud-violet shadow-[0_0_12px_rgba(63,169,255,0.5)]" />
              </div>
              <h3 className="font-display font-semibold text-xl leading-snug mb-3 text-[#f4f6fb]">{c.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-[#9198aa] mb-5 font-light">{c.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {c.tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] text-[#8b93a7] px-[10px] py-[5px] rounded-sm border border-white/10"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CREDENTIALS */}
      <section
        id="credentials"
        className="relative py-24 border-t border-white/[0.06] z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px 400px at 30% 20%, rgba(63,169,255,0.14), transparent 62%), radial-gradient(600px 400px at 75% 60%, rgba(155,107,255,0.14), transparent 62%)",
          }}
        />
        <div className="relative max-w-[1280px] mx-auto px-10">
          <div className="text-center max-w-[600px] mx-auto mb-14">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">{"// Verified"}</span>
            <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-[#f4f6fb] mt-4">
              Credentials &amp; Certifications
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[820px] mx-auto">
            {badges.map((b) => (
              <div
                key={b.abbr}
                className="relative flex items-center gap-6 p-7 rounded border border-white/[0.09] bg-gradient-to-br from-[#141824]/85 to-[#0c0e16]/85 backdrop-blur-sm overflow-hidden transition-all hover:border-cloud-blue/55 hover:shadow-[0_0_0_1px_rgba(63,169,255,0.25),0_24px_70px_rgba(155,107,255,0.20)] hover:-translate-y-1"
              >
                <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cloud-blue to-cloud-violet" />
                <div
                  className="flex-none w-[82px] relative grid place-items-center p-[1.5px]"
                  style={{
                    aspectRatio: "1/1.08",
                    clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
                    background: "linear-gradient(150deg,#3fa9ff,#9b6bff)",
                    filter: "drop-shadow(0 0 16px rgba(63,169,255,0.35))",
                  }}
                >
                  <div
                    className="w-full h-full grid place-items-center bg-[#0a0c12]"
                    style={{ clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)" }}
                  >
                    <span className="font-display font-bold text-[22px] bg-gradient-to-br from-cloud-mist to-cloud-violet bg-clip-text text-transparent">
                      {b.abbr}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] tracking-widest uppercase text-cloud-blue mb-[6px]">{b.issuer}</div>
                  <div className="font-display font-semibold text-lg text-[#f4f6fb] leading-snug">{b.title}</div>
                  <div className="text-[13px] text-[#8b93a7] mt-[6px] font-light">{b.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECT GALLERY */}
      <section id="projects" className="relative max-w-[1280px] mx-auto px-10 py-24 border-t border-white/[0.06] z-10">
        <div className="max-w-[640px] mb-12">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// Project Gallery"}
            </span>
            <span className="flex-1 h-[10px] bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-[#f4f6fb]">
            Selected Builds in Detail
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {projects.map((p) => {
            const Card = (
              <div className="rounded border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] overflow-hidden transition-all group-hover:border-cloud-blue/55 group-hover:shadow-[0_0_0_1px_rgba(63,169,255,0.25),0_20px_60px_rgba(63,169,255,0.18)] group-hover:-translate-y-1 h-full">
                <div
                  className="relative aspect-video grid place-items-center bg-[#0d1018]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(120,140,190,0.10) 0 12px, transparent 12px 24px)",
                  }}
                >
                  <span className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-cloud-blue to-cloud-violet" />
                  <div
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(120% 90% at 70% 10%, rgba(63,169,255,0.14), transparent 55%)" }}
                  />
                  {p.image ? (
                    <Image src={asset(p.image)} alt={p.title} fill className="object-cover opacity-80" />
                  ) : (
                    <span className="relative font-mono text-xs text-[#6b7286] tracking-wide px-5 text-center">
                      {p.label}
                    </span>
                  )}
                  <span className="absolute top-4 left-4 font-mono text-[11px] text-cloud-mist px-[10px] py-[5px] rounded-sm border border-cloud-blue/35 bg-cloud-blue/10 z-10">
                    {p.tag}
                  </span>
                </div>
                <div className="px-6 py-6">
                  <h3 className="font-display font-semibold text-[19px] mb-1 text-[#f4f6fb]">{p.title}</h3>
                  <p className="text-sm text-[#9198aa] font-light">{p.meta}</p>
                </div>
              </div>
            );
            return p.href ? (
              <Link key={p.title} href={p.href} className="group block">
                {Card}
              </Link>
            ) : (
              <div key={p.title} className="group">
                {Card}
              </div>
            );
          })}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="relative border-t border-white/[0.06] px-10 py-28 z-10">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(700px 380px at 30% 0%, rgba(63,169,255,0.14), transparent 60%), radial-gradient(700px 380px at 72% 100%, rgba(155,107,255,0.14), transparent 60%)",
          }}
        />
        <div className="relative max-w-[760px] mx-auto text-center">
          <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">{"// Let's Build"}</span>
          <h2 className="font-display font-semibold text-[clamp(30px,3.6vw,48px)] tracking-tight leading-[1.08] mt-4 mb-5 text-[#f4f6fb]">
            Have an architecture challenge{" "}
            <span className="bg-gradient-to-r from-cloud-blue to-cloud-violet bg-clip-text text-transparent">
              worth solving
            </span>
            ?
          </h2>
          <p className="text-[17px] leading-relaxed text-[#9aa2b4] max-w-[520px] mx-auto mb-10 font-light">
            Available for enterprise cloud, AEM, and generative-AI engagements. Let&apos;s talk about what you&apos;re
            building.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mb-11">
            <a
              href="mailto:frank@frankcloudfabric.io"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-cloud-blue to-cloud-violet text-white px-7 py-[15px] rounded-sm font-semibold text-[15px] shadow-[0_8px_30px_rgba(63,169,255,0.35)] hover:shadow-[0_10px_40px_rgba(63,169,255,0.5)] hover:-translate-y-0.5 transition-all"
            >
              Start a Conversation →
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 text-[#e8eaf0] px-7 py-[15px] rounded-sm font-medium text-[15px] border border-white/[0.16] bg-white/[0.02] hover:border-cloud-blue/60 hover:text-cloud-blue transition-all"
            >
              Download Résumé
            </a>
          </div>
          <div className="flex gap-9 justify-center flex-wrap font-mono text-[13.5px]">
            <a href="mailto:frank@frankcloudfabric.io" className="text-[#aab0c0] hover:text-cloud-blue">
              frank@frankcloudfabric.io
            </a>
            <a href="#" className="text-[#aab0c0] hover:text-cloud-blue">
              LinkedIn
            </a>
            <a href="#" className="text-[#aab0c0] hover:text-cloud-blue">
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-white/[0.06] px-10 py-10 max-w-[1280px] mx-auto flex justify-between items-center flex-wrap gap-4 z-10">
        <span className="font-display font-semibold text-[15px] text-[#c4cad8]">
          Frank<span className="text-cloud-blue">.</span>CloudFabric
        </span>
        <span className="font-mono text-xs text-[#6b7286]">Enterprise AEM · AWS Cloud · Generative AI</span>
      </footer>
    </main>
  );
}
