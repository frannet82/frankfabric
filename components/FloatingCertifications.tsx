"use client";

import Image from 'next/image';
import { useState, type CSSProperties, type PointerEvent } from 'react';
import { asset } from '@/lib/asset';

type Credential = { abbr: string; issuer: string; title: string; meta: string; image: string; href: string; variant?: 'light' };

export default function FloatingCertifications({ badges }: { badges: Credential[] }) {
  const [paused, setPaused] = useState(false);
  const tilt = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--tilt-y', `${x * 24}deg`);
    event.currentTarget.style.setProperty('--tilt-x', `${-y * 16}deg`);
  };
  const reset = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.removeProperty('--tilt-x');
    event.currentTarget.style.removeProperty('--tilt-y');
  };
  return <div className="credential-gallery" data-paused={paused}>
    <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
      <p className="text-sm text-slate-400">Select a badge to verify it with the issuer.</p>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} className="credential-motion rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-300 hover:border-cloud-blue focus-visible:outline-2 focus-visible:outline-cloud-blue">{paused ? 'Resume floating' : 'Pause floating'}</button>
    </div>
    <div className="credential-grid">
      {badges.map((badge, index) => <a
        key={badge.abbr}
        href={badge.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${badge.title} — verify credential (opens in a new tab)`}
        className={`credential-link${badge.variant === 'light' ? ' credential-link--light' : ''}`}
        style={{ '--float-delay': `${index * -1.7}s`, '--rest-y': `${index === 1 ? -10 : 10}deg` } as CSSProperties}
        onPointerMove={tilt}
        onPointerLeave={reset}
        onPointerCancel={reset}
      >
        <span className="credential-stage" aria-hidden="true">
          <span className="credential-floor" />
          <span className="credential-float">
            <span className="credential-object">
              {Array.from({length:12}, (_, layer) => <span key={layer} className="credential-edge" style={{transform:`translateZ(${layer - 12}px)`}} />)}
              <span className="credential-face">
                <span className="credential-serial">{String(index + 1).padStart(2,'0')} / CERTIFIED</span>
                <Image src={asset(badge.image)} alt="" width={180} height={180} className="credential-art" />
                <span className="credential-seal">{badge.abbr} <span>↗</span></span>
              </span>
              <span className="credential-shine" />
            </span>
          </span>
        </span>
        <span className="credential-copy">
          <span className="credential-issuer">{badge.issuer}</span>
          <span className="credential-title">{badge.title}</span>
          <span className="credential-meta">{badge.meta}</span>
          <span className="credential-open">View credential <span aria-hidden="true">↗</span></span>
        </span>
      </a>)}
    </div>
  </div>;
}
