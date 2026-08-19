// Same mark as the mobile app icon and the rootah.com marketing site — one
// wordmark drawn three times so it never drifts between runtimes.
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'var(--coral)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(232,75,42,.35)',
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.58} height={(size * 0.58 * 140) / 120} viewBox="-8 -4 116 136">
        <path
          d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
          stroke="#FFFFFF"
          strokeWidth={10}
          fill="none"
          strokeLinecap="square"
        />
        <circle cx={26} cy={24} r={22} fill="#FFFFFF" />
        <circle cx={74} cy={104} r={19} fill="#FFFFFF" />
        <circle cx={74} cy={104} r={5} fill="var(--coral)" />
      </svg>
    </div>
  );
}
