export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Route not found</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 320 }}>
        This route doesn&apos;t exist, isn&apos;t public, or was removed by its creator.
      </p>
      <a href="/" style={{ color: 'var(--rust)', fontWeight: 700, marginTop: 8 }}>
        Back to rootah
      </a>
    </main>
  );
}
