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
          padding: '4px 4px 16px',
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
              borderRadius: 28,
              boxShadow: `0 8px 24px ${screen.shadowColor}33, 0 16px 40px rgba(0,0,0,.16)`,
              overflow: 'hidden',
            }}
          >
            <Image
              src={screen.src}
              alt={screen.alt}
              width={800}
              height={1734}
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
            borderRadius: 14,
            background: '#FFFFFF',
            boxShadow: '0 2px 10px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.07)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="#1A1614" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => scroll(300)}
          aria-label="Next screen"
          className="icon-btn"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--coral)',
            boxShadow: '0 4px 16px rgba(232,75,42,.35)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
