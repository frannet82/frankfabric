"use client";

import { useEffect, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark";

// Order matches the order the sections appear on the page.
const links = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#case-studies", label: "Case Studies" },
  { href: "#credentials", label: "Credentials" },
  { href: "#projects", label: "Projects" },
];

function NavBar({
  active,
  menuOpen,
  onToggle,
  onNavigate,
  compact = false,
  idSuffix,
}: {
  active: string | null;
  menuOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  compact?: boolean;
  idSuffix: string;
}) {
  const menuId = `site-menu-${idSuffix}`;
  return (
    <div className="relative">
      <nav
        aria-label="Primary"
        className={`flex items-center justify-between gap-3 sm:gap-6 pl-4 sm:pl-6 pr-2.5 sm:pr-3 rounded-full border border-white/20 backdrop-blur-md ${
          compact ? "py-2 bg-[rgb(var(--nav-bg)/0.8)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]" : "py-2.5 sm:py-3 bg-white/[0.06]"
        }`}
      >
        <a href="#top" className="flex items-center gap-3 min-w-0 !text-white" onClick={onNavigate}>
          <BrandMark />
          <span className="font-display font-semibold text-[15px] sm:text-[17px] tracking-tight whitespace-nowrap">
            Frank<span className="text-cloud-mist">.</span>CloudFabric
          </span>
        </a>
        <ul className="hidden md:flex items-center gap-1 text-[14.5px]">
          {links.map((l) => {
            const isActive = active === l.href;
            return (
              <li key={l.href}>
                <a
                  href={l.href}
                  aria-current={isActive ? "location" : undefined}
                  className={`relative px-3.5 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cloud-mist ${
                    isActive ? "!text-white bg-white/10" : "!text-white/75 hover:!text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2">
          <a
            href="#contact"
            className="hidden sm:inline-flex flex-none btn-primary px-5 sm:px-6 py-[9px] sm:py-[11px] rounded-full font-semibold text-[13px] sm:text-[14.5px] whitespace-nowrap hover:-translate-y-0.5 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cloud-mist"
          >
            Let&apos;s talk
          </a>
          <button
            type="button"
            className="md:hidden grid place-items-center w-10 h-10 rounded-full border border-white/20 bg-white/[0.06] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cloud-mist"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={onToggle}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div
          id={menuId}
          className="md:hidden absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-white/15 bg-[rgb(var(--nav-bg)/0.95)] backdrop-blur-xl p-2 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={onNavigate}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl !text-white/85 hover:bg-white/[0.06] text-[16px]"
                >
                  {l.label}
                  <span aria-hidden="true" className="text-white/40">→</span>
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            onClick={onNavigate}
            className="mt-2 flex justify-center btn-primary px-6 py-3.5 rounded-xl font-semibold text-[15px]"
          >
            Let&apos;s talk
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * The hero pill nav, plus a compact copy that docks to the top of the viewport
 * once the hero nav scrolls out of view, so the section links stay reachable on
 * a long page. Includes a disclosure menu for small screens (the desktop links
 * are hidden below `md`).
 */
export default function HeroNav() {
  const heroNavRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [menu, setMenu] = useState<"hero" | "dock" | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = heroNavRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setDocked(!entry.isIntersecting);
        // Close any open menu when the bar it belongs to swaps out.
        setMenu(null);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const sections = links
      .map((l) => document.querySelector<HTMLElement>(l.href))
      .filter((s): s is HTMLElement => Boolean(s));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <>
      <div ref={heroNavRef}>
        <NavBar
          idSuffix="hero"
          active={null}
          menuOpen={menu === "hero"}
          onToggle={() => setMenu((m) => (m === "hero" ? null : "hero"))}
          onNavigate={() => setMenu(null)}
        />
      </div>
      <div
        className={`fixed left-0 right-0 top-3 z-50 px-4 sm:px-6 transition-all duration-300 ${
          docked ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        aria-hidden={!docked}
        inert={!docked}
      >
        <div className="max-w-[1100px] mx-auto">
          <NavBar
            idSuffix="dock"
            compact
            active={active}
            menuOpen={menu === "dock"}
            onToggle={() => setMenu((m) => (m === "dock" ? null : "dock"))}
            onNavigate={() => setMenu(null)}
          />
        </div>
      </div>
    </>
  );
}
