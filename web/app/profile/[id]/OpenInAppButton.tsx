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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 54,
        width: '100%',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--coral)',
        color: '#fff',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: 0.2,
        boxShadow: 'var(--elevation-primary-btn)',
        cursor: 'pointer',
      }}
    >
      Open in the Rootah app
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
