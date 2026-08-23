'use client';

import { useState } from 'react';

interface Props {
  title: string;
  text?: string;
  url: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Native share sheet where supported (mobile/Safari), clipboard-copy fallback everywhere else. */
export default function ShareButton({ title, text, url, className, style }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled the native share sheet — no-op
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleShare} className={className} style={style}>
      {copied ? 'Link copied ✓' : 'Share'}
    </button>
  );
}
