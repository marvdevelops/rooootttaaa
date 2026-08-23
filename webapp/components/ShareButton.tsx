'use client';

import { useState } from 'react';

interface Props {
  title: string;
  text?: string;
  url: string;
  count?: number;
  onShare?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Native share sheet where supported (mobile/Safari), clipboard-copy fallback everywhere else. */
export default function ShareButton({ title, text, url, count, onShare, className, style }: Props) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        onShare?.();
      } catch {
        // user cancelled the native share sheet — no count, no-op
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onShare?.();
      setStatus('copied');
    } catch {
      // clipboard permission denied/unavailable — surface it instead of
      // failing silently with no feedback and no counted share.
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <button onClick={handleShare} className={className} style={style}>
      {status === 'copied' ? 'Link copied ✓' : status === 'error' ? "Couldn't copy" : count !== undefined ? `Share · ${count}` : 'Share'}
    </button>
  );
}
