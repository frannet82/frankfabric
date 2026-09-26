"use client";
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

export default function ProjectCarousel({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(2);
  const count = Children.count(children);
  const last = Math.max(0, count - visible);
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => {
      const first = node.firstElementChild as HTMLElement | null;
      if (!first) return;
      const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
      const step = first.offsetWidth + gap;
      const shown = Math.max(1, Math.round((node.clientWidth + gap) / step));
      setVisible(shown);
      setIndex(Math.min(Math.max(0, count - shown), Math.round(node.scrollLeft / step)));
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener('scroll', update); };
  }, [count]);
  const go = (next: number) => {
    const node = track.current;
    if (!node) return;
    const target = node.children[Math.max(0, Math.min(last, next))] as HTMLElement;
    if (!target) return;
    node.scrollTo({ left: target.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const arrowClass = 'grid place-items-center w-10 h-16 md:w-16 md:h-24 rounded-2xl border border-cloud-blue/40 bg-cloud-blue/10 text-3xl md:text-5xl text-white hover:bg-cloud-blue/25 disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cloud-blue focus-visible:outline-offset-4 transition-colors';
  return <div role="region" aria-roledescription="carousel" aria-label="Selected Builds in Detail">
    <p aria-live="polite" className="font-mono text-xs text-white/60 mb-5">{count ? index + 1 : 0}–{Math.min(count, index + visible)} / {count} · Explore the builds</p>
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:gap-5">
      <button type="button" aria-label="Previous build" disabled={index === 0} onClick={() => go(index - 1)} className={arrowClass}>←</button>
      <div ref={track} className="project-carousel flex gap-6 overflow-x-auto snap-x snap-mandatory pb-5 relative" onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(index + (event.key === 'ArrowRight' ? 1 : -1)); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); go(event.key === 'Home' ? 0 : last); }
      }} tabIndex={0} aria-label="Build cards; use left and right arrow keys or swipe">
        {Children.map(children, (child, i) => <div className="min-w-0 shrink-0 basis-full md:basis-[calc((100%-24px)/2)] snap-start" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>{child}</div>)}
      </div>
      <button type="button" aria-label="Next build" disabled={index >= last} onClick={() => go(index + 1)} className={arrowClass}>→</button>
    </div>
  </div>;
}
