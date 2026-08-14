'use client';

import { useEffect, useRef, useState } from 'react';

/** Fades + slides a section in the first time it scrolls into view. */
export default function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);

    // Browsers pause IntersectionObserver callbacks for backgrounded/hidden
    // tabs (and some privacy-hardened browsers block it outright) — a
    // purely decorative reveal-on-scroll effect should never be able to
    // leave real content stuck invisible, so force it visible after a beat
    // regardless.
    const fallback = setTimeout(() => setVisible(true), 1200);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity .6s ease, transform .6s ease',
      }}
    >
      {children}
    </div>
  );
}
