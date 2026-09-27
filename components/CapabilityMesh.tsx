"use client";

import Link from "next/link";
import { useState } from "react";
import type { CapIcon, caps as capsData } from "@/lib/data";

type Cap = (typeof capsData)[number];

const icons: Record<CapIcon, React.ReactNode> = {
  cloud: <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17.2 8.6 4.2 4.2 0 0 1 17 18z" />,
  spark: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" />
      <path d="M5 12v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6" />
    </>
  ),
  fabric: (
    <>
      <path d="M4 8h16M4 12h16M4 16h16" />
      <path d="M8 4v16M12 4v16M16 4v16" opacity="0.55" />
    </>
  ),
  loop: (
    <>
      <path d="M20 12a8 8 0 0 1-14.3 4.9" />
      <path d="M4 12a8 8 0 0 1 14.3-4.9" />
      <path d="M18.5 3.5v3.8h-3.8M5.5 20.5v-3.8h3.8" />
    </>
  ),
  asset: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 15l4.5-4.5 4 4 2.5-2.5L20 17" />
      <circle cx="15.5" cy="9" r="1.4" />
    </>
  ),
};

/**
 * The "Fabric mesh" capability diagram: ring, spokes, central hexagon and six
 * orbiting nodes. Each node is a button; hovering, focusing or tapping it
 * lights up its spoke and fills the detail panel beside the diagram.
 */
export default function CapabilityMesh({ caps, children }: { caps: Cap[]; children?: React.ReactNode }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = caps[activeIdx];
  const isInternal = active.link.href.startsWith("/");

  return (
    <div className="cap-layout">
      <div className="cap-head">{children}</div>
      {/* Detail panel */}
      <div className="cap-panel max-w-[560px] mx-auto lg:mx-0 w-full">
        <div
          id="capability-detail"
          aria-live="polite"
          className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.05] to-white/[0.015] backdrop-blur-md p-7 overflow-hidden"
        >
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cloud-blue to-cloud-violet" />
          <div className="flex items-center gap-3 mb-4">
            <span className="grid place-items-center w-11 h-11 rounded-xl border border-cloud-blue/40 bg-cloud-blue/10 text-cloud-mist">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {icons[active.icon]}
              </svg>
            </span>
            <div>
              <div className="font-mono text-[11px] tracking-[2px] uppercase text-cloud-blue">
                {String(activeIdx + 1).padStart(2, "0")} · {active.code}
              </div>
              <h3 className="font-display font-semibold text-[22px] leading-tight text-[#f4f6fb]">{active.name}</h3>
            </div>
          </div>
          <p className="text-[15.5px] leading-relaxed text-[#b3bacb] font-light mb-6 min-h-[5.2em]">{active.summary}</p>
          {isInternal ? (
            <Link
              href={active.link.href}
              className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wider uppercase !text-cloud-mist hover:!text-white"
            >
              {active.link.label} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <a
              href={active.link.href}
              className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wider uppercase !text-cloud-mist hover:!text-white"
            >
              {active.link.label} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
        {/* Progress dots double as a compact picker on small screens */}
        <div className="flex gap-2 mt-5 justify-center lg:justify-start" aria-hidden="true">
          {caps.map((c, i) => (
            <span
              key={c.code}
              className={`h-[3px] rounded-full transition-all ${i === activeIdx ? "w-8 bg-cloud-blue" : "w-3 bg-white/20"}`}
            />
          ))}
        </div>
      </div>

      {/* Right: the mesh diagram (unchanged visual language) */}
      <div className="cap-diagram relative w-[calc(100%-24px)] sm:w-full max-w-[600px] aspect-square mx-auto">
        <div
          className="absolute inset-[18%] rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(63,169,255,0.30), rgba(155,107,255,0.16) 48%, transparent 70%)",
          }}
        />
        <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cap" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3fa9ff" />
              <stop offset="1" stopColor="#9b6bff" />
            </linearGradient>
          </defs>
          {caps.map((c, i) => {
            const angle = (i / caps.length) * Math.PI * 2 - Math.PI / 2;
            const x = 200 + Math.cos(angle) * 150;
            const y = 200 + Math.sin(angle) * 150;
            const on = i === activeIdx;
            return (
              <line
                key={c.code}
                x1="200"
                y1="200"
                x2={x}
                y2={y}
                stroke={on ? "#5ff2df" : "url(#cap)"}
                strokeWidth={on ? 1.6 : 1}
                strokeDasharray={on ? "none" : "3 6"}
                opacity={on ? 0.9 : 0.5}
                style={{ transition: "opacity .3s, stroke-width .3s" }}
              />
            );
          })}
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
          aria-hidden="true"
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
              <div className="font-mono text-[9px] tracking-widest text-[#8fb3c4]">MESH · {active.code}</div>
            </div>
          </div>
        </div>
        <ul className="contents" aria-label="Capabilities">
          {caps.map((c, i) => {
            const on = i === activeIdx;
            return (
              <li
                key={c.code}
                className="absolute w-[112px] sm:w-[128px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: c.lx, top: c.ly }}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  aria-controls="capability-detail"
                  onClick={() => setActiveIdx(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                  onFocus={() => setActiveIdx(i)}
                  className="group w-full flex flex-col items-center gap-[9px] rounded-xl p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cloud-mist"
                >
                  <span
                    className={`w-[52px] h-[52px] sm:w-[58px] sm:h-[58px] rounded-full grid place-items-center border backdrop-blur-sm transition-all duration-300 ${
                      on
                        ? "bg-[#0b1a2c] border-cloud-mist/80 text-cloud-mist shadow-[0_0_0_4px_rgba(95,242,223,0.12),0_0_28px_rgba(95,242,223,0.45)] scale-110"
                        : "bg-black/90 border-cloud-blue/40 text-[#8ab8ff] shadow-[0_0_20px_rgba(63,169,255,0.18)] group-hover:border-cloud-blue/80"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {icons[c.icon]}
                    </svg>
                  </span>
                  <span className="text-center">
                    <span className={`block font-display font-semibold text-[13px] sm:text-[13.5px] leading-tight transition-colors ${on ? "text-white" : "text-[#cfd4e0]"}`}>
                      {c.name}
                    </span>
                    <span className="block font-mono text-[10px] tracking-widest text-[#7d8aa8] mt-[2px]">{c.code}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
