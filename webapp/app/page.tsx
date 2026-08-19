import Logo from '../components/Logo';

// Placeholder shell for app.rootah.com — styled to the shared design system
// so the real Discover/auth screens (Phase 1) drop into a page that already
// looks like the rest of Rootah, not a default Next.js scaffold.
export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <Logo size={56} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>rootah</h1>
        <p style={{ fontSize: 15, color: 'var(--stone)', maxWidth: 320 }}>
          The web app is under construction. In the meantime, plan your route on the app.
        </p>
      </div>
    </main>
  );
}
