import Image from "next/image";
import Link from "next/link";
import GalleryCarousel from "@/components/GalleryCarousel";
import FloatingCertifications from "@/components/FloatingCertifications";
import HeroNav from "@/components/HeroNav";
import CapabilityMesh from "@/components/CapabilityMesh";
import { stack, cases, badges, caps, projects, ticker } from "@/lib/data";
import { asset } from "@/lib/asset";

export default function Home() {
  const stackLoop = [...stack, ...stack];
  const tickerLoop = [...ticker, ...ticker];

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden relative"
      style={{
        background:
          "var(--page-bg)",
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
      <section aria-hidden="true" className="relative z-10 border-b border-white/[0.06] bg-black/30 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-10 py-2 flex items-center gap-5 font-mono text-[11px] tracking-widest text-ink-4">
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
          <span className="whitespace-nowrap opacity-70">SAN JOSÉ, CR · LAT 9.93 · LON -84.08</span>
        </div>
      </section>

      {/* HERO */}
      <section className="max-w-[1360px] mx-auto mt-5 mb-8 px-4 sm:px-6">
        <div
          className="relative rounded-3xl overflow-hidden md:min-h-[640px] flex flex-col"
          style={{
            background:
              "var(--hero-bg)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: "var(--hero-glow)",
            }}
          />

          <div
            className="hero-portrait absolute right-0 left-0 top-0 h-[420px] md:h-auto md:left-auto md:bottom-0 md:w-[58%]"
          >
            <Image
              src={asset("/images/final_futuristic_avatar.jpg")}
              alt="Frank Murillo, wearing futuristic visor glasses and a holographic jacket"
              fill
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover"
              style={{ objectPosition: "72% 6%" }}
              priority
            />
          </div>

          {/* nav */}
          <div className="relative z-20 px-4 sm:px-6 pt-4 sm:pt-5">
            <HeroNav />
          </div>

          {/* content */}
          <div className="relative z-10 max-w-[740px] px-6 sm:px-14 pt-[250px] md:pt-12 pb-10 md:pb-14 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-5 font-mono text-[12px] sm:text-[12.5px] tracking-[2px] uppercase text-white/90">
              <span className="w-[11px] h-[11px] bg-gradient-to-br from-cloud-mist to-white rotate-45 shadow-[0_0_12px_rgba(95,242,223,0.7)]" />
              Frank Murillo · Cloud &amp; AI Architect
            </div>
            <h1 className="font-display font-bold text-[clamp(38px,4.6vw,66px)] leading-[1.02] tracking-tighter mb-6 text-white">
              Where Enterprise AEM &amp;&nbsp;AWS&nbsp;Cloud{" "}
              <span className="sm:block sm:whitespace-nowrap pr-2 bg-gradient-to-r headline-gradient">
                Meet Generative&nbsp;AI.
              </span>
            </h1>
            <p className="text-[17px] sm:text-lg leading-relaxed text-white/80 max-w-[480px] mb-8 font-light">
              I&apos;m Frank Murillo, a cloud and AI architect with 12+ years on Adobe Experience Manager and AWS.
              I design platforms that hold up at enterprise scale, then put generative AI to work on them.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 btn-primary px-7 py-[14px] rounded-full font-semibold text-[15px] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(95,242,223,0.25)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cloud-mist"
              >
                Work with me <span aria-hidden="true">→</span>
              </a>
              <a
                href="#case-studies"
                className="inline-flex items-center gap-2 !text-white px-6 py-[13px] rounded-full font-medium text-[15px] border border-white/30 bg-white/[0.04] backdrop-blur-sm hover:border-white/60 hover:bg-white/[0.08] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cloud-mist"
              >
                See my work
              </a>
            </div>
            <dl className="grid grid-cols-3 max-w-[460px] border-t border-white/15 pt-5">
              {[
                { v: "3×", l: "AWS & Adobe certified" },
                { v: "12+", l: "Years in architecture" },
                { v: String(cases.length), l: "Case studies" },
              ].map((stat, i) => (
                <div key={stat.l} className={`flex flex-col gap-1 ${i ? "pl-4 sm:pl-6 border-l border-white/15" : "pr-4"}`}>
                  <dt className="order-2 text-[12.5px] leading-snug text-white/70">{stat.l}</dt>
                  <dd className="order-1 font-display font-bold text-[26px] sm:text-3xl text-white leading-none">{stat.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* STACK MARQUEE */}
      <section aria-labelledby="stack-label" className="border-y border-white/[0.06] bg-white/[0.015] py-5 overflow-hidden relative z-10">
        <div className="max-w-[1280px] mx-auto mb-3 px-5 sm:px-10">
          <span id="stack-label" className="font-mono text-[11.5px] tracking-[2px] uppercase text-ink-3">
            Tools I build with
          </span>
        </div>
        <ul className="sr-only">
          {stack.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
        <div aria-hidden="true" className="stack-rail relative [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="flex gap-10 w-max animate-marquee items-center px-5">
            {stackLoop.map((tech, i) => (
              <span key={i} className="flex items-center gap-10 whitespace-nowrap">
                <span className="font-display font-medium text-[19px] sm:text-[22px] text-ink-2 tracking-wide">{tech}</span>
                <span className="w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-cloud-blue to-cloud-violet opacity-70" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="capabilities" className="relative max-w-[1280px] mx-auto px-5 sm:px-10 pt-20 sm:pt-24 pb-20 z-10 scroll-mt-20">
        <CapabilityMesh caps={caps}>
          <div className="max-w-[560px]">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// What I do"}
            </span>
            <span className="flex-1 h-[10px] bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-ink-1 mb-3">
            How I can help
          </h2>
          <p className="text-[16px] leading-relaxed text-ink-3 font-light">
            Six areas I work across, all connected. Select one to see what it covers and where I&apos;ve applied it.
          </p>
        </div>
        </CapabilityMesh>
      </section>

      {/* CASE STUDIES */}
      <section id="case-studies" className="relative max-w-[1280px] mx-auto px-5 sm:px-10 pt-24 pb-20 z-10">
        <GalleryCarousel
          label="Architecture case studies"
          itemNoun="case study"
          header={
            <div className="max-w-[640px]">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// Selected Work"}
            </span>
            <span className="flex-1 h-[10px] bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-ink-1">
            Systems I&apos;ve architected
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-3 font-light">
            Real enterprise AEM and AWS work, each with an interactive diagram you can explore.
          </p>
        </div>
          }
        >
          {cases.map((c) => (
            <Link key={c.num} href={c.href} className="group block focus-visible:outline-none">
              {/* Media: the architecture diagram, framed like a photo */}
              <div className="relative aspect-[4/3] md:aspect-[16/10] rounded-2xl overflow-hidden bg-cloud-panel ring-1 ring-white/10 transition-all duration-500 group-hover:ring-cloud-blue/50 group-hover:shadow-[0_30px_80px_-20px_rgb(var(--c-violet)/0.35)] group-focus-visible:ring-2 group-focus-visible:ring-cloud-blue">
                <Image
                  src={asset(c.image)}
                  alt={`${c.title} architecture diagram preview`}
                  fill
                  sizes="(min-width: 768px) 600px, 86vw"
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(180deg, rgb(var(--c-bg) / 0) 55%, rgb(var(--c-bg) / 0.7) 100%)" }}
                />
                <span className="absolute top-4 left-4 font-mono text-[11px] tracking-[2px] text-ink-1 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15">
                  {c.num}
                </span>
                <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[#150a2e] bg-white px-4 py-2 rounded-full opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
                  Explore the diagram <span aria-hidden="true">↗</span>
                </span>
              </div>
              {/* Caption */}
              <div className="pt-5 pr-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 font-mono text-[11px] tracking-[1.5px] uppercase text-cloud-blue">
                  {c.tags.join(" · ")}
                </div>
                <h3 className="font-display font-semibold text-[21px] leading-snug mb-2 text-ink-1 transition-colors group-hover:text-cloud-blue">
                  {c.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-ink-3 font-light max-w-[52ch]">{c.desc}</p>
              </div>
            </Link>
          ))}
        </GalleryCarousel>
      </section>

      {/* CREDENTIALS */}
      <section id="credentials" className="cert-section relative py-24 border-t border-white/[0.06] z-10">
        <div className="cert-section__glow absolute inset-0 pointer-events-none" />
        <div className="relative max-w-[1280px] mx-auto px-10">
          <div className="text-center max-w-[600px] mx-auto mb-14">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">{"// Verified"}</span>
            <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-ink-1 mt-4">
              Certified by AWS and Adobe
            </h2>
          </div>
          <FloatingCertifications badges={badges} />
        </div>
      </section>

      {/* PROJECT GALLERY */}
      <section id="projects" className="relative max-w-[1280px] mx-auto px-5 sm:px-10 py-24 border-t border-white/[0.06] z-10">
        <GalleryCarousel
          label="Live side projects"
          itemNoun="project"
          header={
            <div className="max-w-[640px]">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue whitespace-nowrap">
              {"// Project Gallery"}
            </span>
            <span className="flex-1 h-[10px] bg-[repeating-linear-gradient(90deg,rgba(63,169,255,0.45)_0_1px,transparent_1px_9px)]" />
          </div>
          <h2 className="font-display font-semibold text-[clamp(28px,3.2vw,42px)] tracking-tight text-ink-1">
            Live side projects
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-3 font-light">
            Where I experiment with 3D, voice and generative AI in the browser. They all run live, so jump in and try one.
          </p>
        </div>
          }
        >
          {projects.map((p) => {
            const Card = (
              <div className="h-full">
                <div
                  className="gallery-media relative aspect-[4/3] md:aspect-[16/10] min-w-0 grid place-items-center bg-cloud-panel rounded-2xl overflow-hidden ring-1 ring-white/10 transition-all duration-500 group-hover:ring-cloud-blue/50 group-hover:shadow-[0_30px_80px_-20px_rgb(var(--c-violet)/0.35)] group-focus-visible:ring-2 group-focus-visible:ring-cloud-blue"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(120,140,190,0.10) 0 12px, transparent 12px 24px)",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(120% 90% at 70% 10%, rgba(63,169,255,0.14), transparent 55%)" }}
                  />
                  {p.href === "/projects/chef-chatbot" ? (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center bg-gradient-to-b from-ac-sky/40 to-ac-leaf/25">
                      {/* Stylized chef toque mark — pure CSS/SVG poster, no 3D
                          canvas. Cozy Animal-Crossing palette so the preview
                          matches the live chatbot. The whole card links out to
                          the live chef. */}
                      <div className="flex min-w-0 w-full flex-col items-center gap-3">
                        <span className="grid place-items-center w-16 h-16 rounded-2xl border border-ac-leaf/50 bg-ac-cream/90 shadow-[0_6px_20px_rgba(95,168,90,0.28)]">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="w-9 h-9"
                            fill="none"
                            stroke="url(#chef-toque)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <defs>
                              <linearGradient id="chef-toque" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stopColor="#8fce7a" />
                                <stop offset="1" stopColor="#f6a545" />
                              </linearGradient>
                            </defs>
                            <path d="M6 14a4 4 0 0 1-1-7.87A4 4 0 0 1 12 4a4 4 0 0 1 7 2.13A4 4 0 0 1 18 14z" />
                            <path d="M6 14v4.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V14" />
                          </svg>
                        </span>
                        <span className="font-display font-semibold text-[20px] tracking-tight bg-gradient-to-r from-ac-leafDark to-ac-orange bg-clip-text text-transparent">
                          Chef Fabric
                        </span>
                        <span className="font-mono text-[10.5px] tracking-widest uppercase text-white/85">
                          Live recipe assistant · click to chat
                        </span>
                      </div>
                    </div>
                  ) : p.href === "/projects/coach-trainer" ? (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center bg-gradient-to-b from-sf-ink to-sf-gray">
                      {/* Stylized dumbbell mark — pure CSS/SVG poster, no 3D
                          canvas. Bold gym-style yellow/black/magenta palette so
                          the preview matches the live coach. The whole card
                          links out to the live coach. */}
                      <div className="flex min-w-0 w-full flex-col items-center gap-3">
                        <span className="grid place-items-center w-16 h-16 rounded-2xl border border-sf-yellow/50 bg-sf-black/90 shadow-[0_6px_20px_rgba(230,0,126,0.35)]">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="w-9 h-9"
                            fill="none"
                            stroke="url(#coach-dumbbell)"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <defs>
                              <linearGradient id="coach-dumbbell" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stopColor="#FFF200" />
                                <stop offset="1" stopColor="#E6007E" />
                              </linearGradient>
                            </defs>
                            <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
                          </svg>
                        </span>
                        <span className="font-display font-bold text-[20px] tracking-tight bg-gradient-to-r from-sf-yellow to-sf-magenta bg-clip-text text-transparent">
                          Coach Fabric
                        </span>
                        <span className="font-mono text-[10.5px] tracking-widest uppercase text-sf-mist/80">
                          Live AI fitness trainer · click to chat
                        </span>
                      </div>
                    </div>
                  ) : p.href === "/projects/virtual-pet" ? (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center bg-gradient-to-b from-pet-accentSoft/60 to-pet-clean/25">
                      {/* Stylized dog/paw mark — pure CSS/SVG poster, no 3D
                          canvas. Warm cozy virtual-pet palette so the preview
                          matches the live virtual pet. The whole card links out
                          to the live pet. */}
                      <div className="flex min-w-0 w-full flex-col items-center gap-3">
                        <span className="grid place-items-center w-16 h-16 rounded-2xl border border-pet-accent/50 bg-pet-paper/90 shadow-[0_6px_20px_rgba(224,138,76,0.30)]">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="w-9 h-9"
                            fill="none"
                            stroke="url(#pet-paw)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <defs>
                              <linearGradient id="pet-paw" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stopColor="#e08a4c" />
                                <stop offset="1" stopColor="#5fc2c7" />
                              </linearGradient>
                            </defs>
                            <path d="M12 13.5c-2.2 0-4 1.6-4 3.4 0 1.3 1.1 2.1 2.4 2.1.7 0 1.1-.3 1.6-.3s.9.3 1.6.3c1.3 0 2.4-.8 2.4-2.1 0-1.8-1.8-3.4-4-3.4Z" />
                              <ellipse cx="7.3" cy="10.4" rx="1.15" ry="1.5" />
                              <ellipse cx="16.7" cy="10.4" rx="1.15" ry="1.5" />
                              <ellipse cx="10" cy="7.6" rx="1.05" ry="1.4" />
                              <ellipse cx="14" cy="7.6" rx="1.05" ry="1.4" />
                          </svg>
                        </span>
                        <span className="font-display font-semibold text-[20px] tracking-tight bg-gradient-to-r from-pet-accent to-pet-clean bg-clip-text text-transparent">
                          Fabric Pet
                        </span>
                        <span className="font-mono text-[10.5px] tracking-widest uppercase text-pet-ink/80">
                          Live virtual pet · click to care
                        </span>
                      </div>
                    </div>
                  ) : p.href === "/projects/pet-puzzles" ? (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center bg-gradient-to-b from-puz-cream to-puz-paper">
                      {/* Three stacked game tiles — pure CSS/SVG poster, no
                          iframe. Warm paper ground with the pink of Pet Jump
                          and the leaf green of Pet Tower Sort, so the preview
                          matches the live games. The whole card links out to
                          the playable build. */}
                      <div className="flex min-w-0 w-full flex-col items-center gap-3">
                        <span className="flex items-end gap-2">
                          <span className="grid place-items-center w-12 h-12 rounded-[14px] bg-[#e9e5de] shadow-[0_3px_0_#c6c0b6]">
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-8 h-8 text-[#574e44]">
                              <path d="M5.6 9.4 4.7 4.2 9.3 6.6zM18.4 9.4l.9-5.2-4.6 2.4z" fill="#fffdf9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                              <ellipse cx="12" cy="13.2" rx="7.1" ry="6.2" fill="#fffdf9" stroke="currentColor" strokeWidth="1.5" />
                              <circle cx="9.5" cy="12.4" r="1" fill="currentColor" />
                              <circle cx="14.5" cy="12.4" r="1" fill="currentColor" />
                              <path d="M10.9 14.6h2.2L12 16z" fill="currentColor" />
                            </svg>
                          </span>
                          <span className="grid place-items-center w-12 h-12 rounded-[14px] bg-[#fad1e0] shadow-[0_3px_0_#e7a4be] -translate-y-2">
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-8 h-8 text-[#a63c69]">
                              <g fill="#fffdf9" stroke="currentColor" strokeWidth="1.4">
                                <ellipse cx="12" cy="5.9" rx="2.9" ry="3.3" />
                                <ellipse cx="17.9" cy="10.2" rx="2.9" ry="3.3" transform="rotate(72 17.9 10.2)" />
                                <ellipse cx="15.6" cy="17.1" rx="2.9" ry="3.3" transform="rotate(144 15.6 17.1)" />
                                <ellipse cx="8.4" cy="17.1" rx="2.9" ry="3.3" transform="rotate(216 8.4 17.1)" />
                                <ellipse cx="6.1" cy="10.2" rx="2.9" ry="3.3" transform="rotate(288 6.1 10.2)" />
                              </g>
                              <circle cx="12" cy="11.8" r="2.9" fill="currentColor" />
                            </svg>
                          </span>
                          <span className="grid place-items-center w-12 h-12 rounded-[14px] bg-[#d7efd1] shadow-[0_3px_0_#a4d29a] translate-y-1">
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-8 h-8 text-[#357840]">
                              <circle cx="12" cy="13.4" r="7.8" fill="#fffdf9" stroke="currentColor" strokeWidth="1.5" />
                              <g stroke="currentColor" strokeWidth="1.25" fill="none" opacity="0.6">
                                <path d="M12 5.8c-2.9 2.2-4.4 5-4.4 7.9s1.7 5.5 4.4 7.3" />
                                <path d="M12 5.8c2.9 2.2 4.4 5 4.4 7.9s-1.7 5.5-4.4 7.3" />
                                <path d="M4.5 11.6c2.5 1.1 4.9 1.6 7.5 1.6s5-.5 7.5-1.6" />
                              </g>
                            </svg>
                          </span>
                        </span>
                        <span className="font-display font-semibold text-[20px] tracking-tight bg-gradient-to-r from-puz-pinkDeep to-puz-leafDeep bg-clip-text text-transparent">
                          Pet Puzzles
                        </span>
                        <span className="font-mono text-[10.5px] tracking-widest uppercase text-puz-ink/80">
                          Two tile games · click to play
                        </span>
                      </div>
                    </div>
                  ) : p.video ? (
                    <video
                      src={asset(p.video)}
                      poster={p.image ? asset(p.image) : undefined}
                      aria-label={p.title}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover opacity-80"
                    />
                  ) : p.image ? (
                    <Image src={asset(p.image)} alt={p.title} fill className="object-cover opacity-80" />
                  ) : (
                    <span className="relative font-mono text-xs text-ink-4 tracking-wide px-5 text-center">
                      {p.label}
                    </span>
                  )}
                  <span className="absolute top-4 left-4 font-mono text-[11px] tracking-[1.5px] uppercase text-ink-1 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 z-10">
                    {p.tag}
                  </span>
                  {p.href && (
                    <span className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 text-[13px] font-semibold text-[#150a2e] bg-white px-4 py-2 rounded-full opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
                      Open live demo <span aria-hidden="true">↗</span>
                    </span>
                  )}
                </div>
                <div className="pt-5 pr-2">
                  <h3 className="font-display font-semibold text-[21px] leading-snug mb-2 text-ink-1 transition-colors group-hover:text-cloud-blue">{p.title}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-3 font-light max-w-[52ch]">{p.meta}</p>
                </div>
              </div>
            );
            return p.href ? (
              <Link key={p.title} href={p.href} className="group block focus-visible:outline-none">
                {Card}
              </Link>
            ) : (
              <div key={p.title} className="group">
                {Card}
              </div>
            );
          })}
        </GalleryCarousel>
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
          <h2 className="font-display font-semibold text-[clamp(30px,3.6vw,48px)] tracking-tight leading-[1.08] mt-4 mb-5 text-ink-1">
            Have an architecture challenge{" "}
            <span className="bg-gradient-to-r from-cloud-blue to-cloud-violet bg-clip-text text-transparent">
              worth solving
            </span>
            ?
          </h2>
          <p className="text-[17px] leading-relaxed text-ink-3 max-w-[520px] mx-auto mb-10 font-light">
            I&apos;m available for enterprise cloud, AEM and generative-AI work. Tell me what you&apos;re building and
            let&apos;s see where I can help.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mb-11">
            <a
              href="mailto:frank@frankcloudfabric.io"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-cloud-blue to-cloud-violet !text-[#150a2e] px-7 py-[15px] rounded-sm font-semibold text-[15px] shadow-[0_8px_30px_rgba(63,169,255,0.35)] hover:shadow-[0_10px_40px_rgba(63,169,255,0.5)] hover:-translate-y-0.5 transition-all"
            >
              Email me →
            </a>
            <a
              href="https://www.linkedin.com/in/franciscomurillo03b7uita85b0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-ink-1 px-7 py-[15px] rounded-sm font-medium text-[15px] border border-white/[0.16] bg-white/[0.02] hover:border-cloud-blue/60 hover:text-cloud-blue transition-all"
            >
              Connect on LinkedIn <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <div className="flex gap-9 justify-center flex-wrap font-mono text-[13.5px]">
            <a href="mailto:frank@frankcloudfabric.io" className="text-ink-2 hover:text-cloud-blue">
              frank@frankcloudfabric.io
            </a>
            <a href="https://www.linkedin.com/in/franciscomurillo03b7uita85b0" target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-cloud-blue">
              LinkedIn
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-white/[0.06] px-10 py-10 max-w-[1280px] mx-auto flex justify-between items-center flex-wrap gap-4 z-10">
        <span className="font-display font-semibold text-[15px] text-ink-2">
          Frank<span className="text-cloud-blue">.</span>CloudFabric
        </span>
        <span className="font-mono text-xs text-ink-4">© {new Date().getFullYear()} Frank Murillo · Enterprise AEM · AWS Cloud · Generative AI</span>
      </footer>
    </main>
  );
}
