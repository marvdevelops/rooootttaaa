'use client';

import Image from 'next/image';
import { useRef } from 'react';

interface Screen {
  src: string;
  alt: string;
  shadowColor: string;
}

export default function ScreensCarousel({ screens }: { screens: Screen[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollerRef}
        style={{
          display: 'flex',
          gap: 24,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '4px 4px 12px',
          scrollbarWidth: 'none',
        }}
      >
        {screens.map((screen) => (
          <div
            key={screen.src}
            style={{
              flex: '0 0 min(260px,78vw)',
              scrollSnapAlign: 'start',
              background: 'var(--ink)',
              border: '4px solid var(--ink)',
              borderRadius: 28,
              boxShadow: `8px 8px 0 ${screen.shadowColor}`,
              overflow: 'hidden',
            }}
          >
            <Image
              src={screen.src}
              alt={screen.alt}
              width={738}
              height={1600}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 18 }}>
        <button
          onClick={() => scroll(-300)}
          aria-label="Previous screen"
          className="icon-btn"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#FFFFFF',
            border: '3px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="#222A2A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => scroll(300)}
          aria-label="Next screen"
          className="icon-btn"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--rust)',
            border: '3px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#E2DAC2" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
