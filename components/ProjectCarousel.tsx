"use client";
import { Children, useRef, useState, type ReactNode } from 'react';

export default function ProjectCarousel({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = Children.count(children);
  const go = (next: number) => {
    const node = track.current;
    if (!node) return;
    const target = node.children[Math.max(0, Math.min(count - 1, next))] as HTMLElement;
    node.scrollTo({ left: target.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div role="region" aria-roledescription="carousel" aria-label="Selected Builds in Detail">
    <div className="flex items-center justify-between gap-4 mb-5">
      <p aria-live="polite" className="font-mono text-xs text-white/60">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')} · Explore the builds</p>
      <div className="flex gap-2">
        <button aria-label="Previous build" disabled={index === 0} onClick={() => go(index - 1)} className="rounded-full border border-white/25 px-5 py-2 text-white disabled:opacity-25 hover:bg-white/10">←</button>
        <button aria-label="Next build" disabled={index === count - 1} onClick={() => go(index + 1)} className="rounded-full border border-white/25 px-5 py-2 text-white disabled:opacity-25 hover:bg-white/10">→</button>
      </div>
    </div>
    <div ref={track} className="project-carousel flex gap-6 overflow-x-auto snap-x snap-mandatory pb-5 relative" onScroll={() => {
      const node = track.current;
      if (!node) return;
      const nearest = Array.from(node.children).slice(0, count).reduce((best, child, i) => Math.abs((child as HTMLElement).offsetLeft - node.scrollLeft) < Math.abs((node.children[best] as HTMLElement).offsetLeft - node.scrollLeft) ? i : best, 0);
      setIndex(nearest);
    }} onKeyDown={event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(index + (event.key === 'ArrowRight' ? 1 : -1)); }
    }} tabIndex={0} aria-label="Build cards; use left and right arrow keys or swipe">
      {Children.map(children, (child, i) => <div className="shrink-0 basis-[88%] md:basis-[72%] snap-start" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>{child}</div>)}
      <div aria-hidden="true" className="shrink-0 basis-[12%] md:basis-[28%] -ml-6" />
    </div>
  </div>;
}
