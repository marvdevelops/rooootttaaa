'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  text?: string;
  url: string;
  count?: number;
  onShare?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Share menu with the major social platforms, plus native share (mobile) and copy-link. */
export default function ShareButton({ title, text, url, count, onShare, className, style }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  function openShareWindow(shareUrl: string) {
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
    onShare?.();
    setOpen(false);
  }

  const shareText = text ?? title;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  const socialLinks = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: '📘' },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, icon: '𝕏' },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, icon: '💬' },
    { label: 'Messenger', href: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=966242223397117&redirect_uri=${encodedUrl}`, icon: '✉️' },
  ];

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text, url });
      onShare?.();
    } catch {
      // user cancelled the device share sheet — no-op
    }
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      onShare?.();
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 2000);
    setOpen(false);
  }

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', flex: style?.flex }}>
      <button onClick={() => setOpen((v) => !v)} className={className} style={{ width: '100%', ...style }}>
        {status === 'copied' ? 'Link copied ✓' : status === 'error' ? "Couldn't copy" : count !== undefined ? `Share · ${count}` : 'Share'}
      </button>

      {open && (
        <div className="share-menu">
          {socialLinks.map((s) => (
            <button key={s.label} onClick={() => openShareWindow(s.href)} className="share-menu-item">
              <span aria-hidden style={{ fontSize: 16 }}>
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
          <button onClick={handleCopy} className="share-menu-item">
            <span aria-hidden style={{ fontSize: 16 }}>
              🔗
            </span>
            Copy link
          </button>
          {hasNativeShare && (
            <button onClick={handleNativeShare} className="share-menu-item">
              <span aria-hidden style={{ fontSize: 16 }}>
                📤
              </span>
              More options…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
