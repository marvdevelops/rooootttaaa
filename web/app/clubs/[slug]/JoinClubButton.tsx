'use client';

import { useRouter } from 'next/navigation';

interface Props {
  clubId: string;
}

/**
 * Hands off to the Rootah app (rootah://clubs/{id}) so the user lands on the
 * club and can join; if nothing intercepts the scheme within a beat (app not
 * installed), falls back to the download section.
 */
export default function JoinClubButton({ clubId }: Props) {
  const router = useRouter();

  const handleClick = () => {
    const fallbackTimer = setTimeout(() => {
      router.push('/#download');
    }, 1200);
    window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true });
    window.location.href = `rootah://clubs/${clubId}`;
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
      Join the Club
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
