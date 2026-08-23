'use client';

export type PaywallTrigger = 'group_run_join_limit' | 'general';

const TRIGGER_HEADLINE: Record<PaywallTrigger, string> = {
  group_run_join_limit: "You've joined your one free event",
  general: 'Get more out of every run',
};

const TRIGGER_SUBHEAD: Record<PaywallTrigger, string> = {
  group_run_join_limit: 'Go Pro to join unlimited events, any time.',
  general: 'Unlock unlimited routes, unlimited group runs, and room to plan bigger.',
};

const PRO_BENEFITS = [
  'Unlimited saved routes — never hit a cap',
  'Import GPX files from Strava, Garmin, and more',
  'Host unlimited group runs at once',
  'Plan longer routes — up to 50km per leg',
  'Customize and remix any public route',
];

interface Props {
  trigger?: PaywallTrigger;
  onClose: () => void;
}

/** Subscriptions are purchased through the mobile app (RevenueCat/App Store) — web only markets Pro and hands off to the app. */
export default function PaywallModal({ trigger = 'general', onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,14,.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--panel, #fff)', borderRadius: 20, maxWidth: 420, width: '100%', padding: 28, position: 'relative' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'var(--cream, #F2EDE5)', cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>

        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--coral)' }}>Rootah Pro</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px', margin: '6px 0 4px' }}>{TRIGGER_HEADLINE[trigger]}</h2>
        <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5, margin: '0 0 18px' }}>{TRIGGER_SUBHEAD[trigger]}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {PRO_BENEFITS.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--sage)', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                ✓
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{b}</span>
            </div>
          ))}
        </div>

        <a
          href="https://www.rootah.com/#download"
          target="_blank"
          rel="noreferrer"
          className="discover-run-btn"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          Continue in the Rootah app
        </a>
        <p style={{ fontSize: 11.5, color: 'var(--mist)', textAlign: 'center', marginTop: 10 }}>
          Rootah Pro subscriptions are managed in the mobile app.
        </p>
      </div>
    </div>
  );
}
