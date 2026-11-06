'use client';

/**
 * Root global error boundary. Replaces the root layout when the layout itself
 * fails, so it MUST render its own <html>/<body> and cannot rely on
 * globals.css (which is loaded by the layout it replaces). All styling here
 * is intentionally inline/self-contained and always uses the light palette.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#eef2f7',
          color: '#0f172a',
        }}
      >
        <style>{`
          body { background-color: #eef2f7; color: #0f172a; }
          .ge-card { background: #ffffff !important; border-color: #e2e8f0 !important; }
          .ge-muted { color: #334155 !important; }
        `}</style>
        <main style={{ width: '100%', maxWidth: '32rem' }}>
          <div
            className="ge-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '2rem',
              textAlign: 'center',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                margin: '0 auto 1rem',
                width: '4rem',
                height: '4rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
              aria-hidden="true"
            >
              ⚠️
            </div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Something went wrong
            </h1>
            <p className="ge-muted" style={{ marginTop: '0.75rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#334155' }}>
              An unexpected error occurred while rendering the application. Your
              session is safe — please try again.
            </p>
            <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  minHeight: 44,
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(to right, #06b6d4, #6366f1)',
                }}
              >
                Try again
              </button>
            </div>
            {error instanceof Error && 'digest' in error && error.digest ? (
              <p className="ge-muted" style={{ marginTop: '1.25rem', fontSize: '0.6875rem', color: '#64748b' }}>
                Reference: {String(error.digest)}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
