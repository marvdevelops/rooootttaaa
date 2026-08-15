'use client';

import { useRouter } from 'next/navigation';

interface Props {
  runId: string;
  label?: string;
}

/**
 * Same handoff pattern as the route detail page's button — try the custom
 * URL scheme, fall back to the landing page's download section if nothing
 * intercepts the navigation (app not installed).
 */
export default function OpenInAppButton({ runId, label = 'OPEN IN THE ROOTAH APP' }: Props) {
  const router = useRouter();

  const handleClick = () => {
    const fallbackTimer = setTimeout(() => {
      router.push('/#download');
    }, 1200);

    window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true });
    window.location.href = `rootah://runs/${runId}`;
  };

  return (
    <button
      onClick={handleClick}
      className="brutal-btn"
      style={
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 56,
          width: '100%',
          borderRadius: 14,
          background: 'var(--rust)',
          color: 'var(--sand)',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          border: '3px solid var(--ink)',
          boxShadow: '4px 4px 0px var(--ink)',
          cursor: 'pointer',
          '--hover-shadow': '6px 6px 0px var(--ink)',
          '--active-shadow': '1px 1px 0px var(--ink)',
        } as React.CSSProperties
      }
    >
      {label}
    </button>
  );
}
