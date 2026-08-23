'use client';

import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
}

/**
 * Tries to hand off to the Rootah app via its custom URL scheme; if nothing
 * intercepts the navigation within a beat (app not installed, or this
 * environment doesn't support the scheme yet), falls back to the landing
 * page's download section instead of a broken/placeholder store link.
 */
export default function OpenInAppButton({ userId }: Props) {
  const router = useRouter();

  const handleClick = () => {
    const fallbackTimer = setTimeout(() => {
      router.push('/#download');
    }, 1200);

    window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true });
    window.location.href = `rootah://profile/${userId}`;
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
      OPEN IN THE ROOTAH APP
    </button>
  );
}
