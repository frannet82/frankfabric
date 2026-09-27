"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Photo-gallery style carousel.
 *
 * - Media-first slides that bleed off the right edge of the page, so the next
 *   slide peeks in and invites a swipe.
 * - Slides in view are full strength; the peeking ones are dimmed.
 * - Round prev/next buttons and a "01 / 06" counter sit beside the heading;
 *   a segmented progress bar under the track doubles as slide navigation.
 * - Native scroll-snap for touch/trackpad, arrow keys / Home / End for keyboard.
 *
 * Slide width is sized against the section container (container query units),
 * not the bleeding track, so `perView` slides line up with the heading above.
 */
export default function GalleryCarousel({
  children,
  header,
  label,
  itemNoun = "slide",
}: {
  children: ReactNode;
  header?: ReactNode;
  label: string;
  itemNoun?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(2);
  const count = Children.count(children);
  const last = Math.max(0, count - visible);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const first = node.firstElementChild as HTMLElement | null;
        if (!first) return;
        const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
        const step = first.offsetWidth + gap;
        // Slides that fit inside the section container (not the bleed area).
        const containerWidth = node.parentElement?.parentElement?.clientWidth ?? node.clientWidth;
        const shown = Math.max(1, Math.floor((containerWidth + gap + 2) / step));
        setVisible(shown);
        setIndex(Math.min(Math.max(0, count - shown), Math.round(node.scrollLeft / step)));
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, [count]);

  const go = useCallback(
    (next: number) => {
      const node = track.current;
      if (!node) return;
      const target = node.children[Math.max(0, Math.min(last, next))] as HTMLElement | undefined;
      if (!target) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollTo({ left: target.offsetLeft - node.offsetLeft, behavior: reduce ? "auto" : "smooth" });
    },
    [last],
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const arrow =
    "grid place-items-center w-12 h-12 rounded-full border border-white/15 bg-white/[0.04] text-ink-1 backdrop-blur-sm transition-all hover:border-cloud-blue/70 hover:bg-cloud-blue/10 hover:text-cloud-blue disabled:opacity-30 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cloud-blue";

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="gallery-carousel">
      {/* Header row: heading on the left, counter + arrows on the right */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
        <div className="min-w-0">{header}</div>
        <div className="flex items-center gap-5 shrink-0">
          <p aria-live="polite" className="font-mono text-[13px] tracking-[2px] text-ink-3 tabular-nums">
            <span className="text-ink-1">{pad(Math.min(count, index + 1))}</span>
            {visible > 1 && index + visible <= count && <span className="text-ink-3">–{pad(index + visible)}</span>}
            <span className="mx-2 text-ink-4">/</span>
            {pad(count)}
          </p>
          <div className="flex gap-2.5">
            <button type="button" aria-label={`Previous ${itemNoun}`} disabled={index === 0} onClick={() => go(index - 1)} className={arrow}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" aria-label={`Next ${itemNoun}`} disabled={index >= last} onClick={() => go(index + 1)} className={arrow}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Track: bleeds to the right edge of the viewport */}
      <div className="gallery-bleed">
        <div
          ref={track}
          tabIndex={0}
          aria-label={`${label}: use the left and right arrow keys or swipe`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              go(index + (e.key === "ArrowRight" ? 1 : -1));
            }
            if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              go(e.key === "Home" ? 0 : last);
            }
          }}
          className="gallery-track flex gap-6 overflow-x-auto snap-x snap-mandatory pb-2"
        >
          {Children.map(children, (child, i) => {
            const inView = i >= index && i < index + visible;
            return (
              <div
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                className={`gallery-slide shrink-0 snap-start transition-opacity duration-500 ${inView ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
              >
                {child}
              </div>
            );
          })}
          {/* Spacer so the last slide can snap flush with the container edge */}
          <div aria-hidden="true" className="gallery-spacer shrink-0" />
        </div>
      </div>

      {/* Segmented progress bar = slide navigation */}
      <div className="mt-8 flex gap-1.5" role="group" aria-label={`Choose a ${itemNoun}`}>
        {Array.from({ length: count }, (_, i) => {
          const on = i >= index && i < index + visible;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Go to ${itemNoun} ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
              className="group flex-1 max-w-[72px] py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cloud-blue rounded"
            >
              <span
                className={`block h-[3px] rounded-full transition-colors duration-300 ${
                  on ? "bg-gradient-to-r from-cloud-blue to-cloud-violet" : "bg-white/15 group-hover:bg-white/35"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
