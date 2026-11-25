'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';

const CONSENT_KEY = 'tp_analytics_consent';

type AnalyticsConsentValue = 'granted' | 'denied';

/**
 * Google Analytics is opt-in and always runs with ads personalization disabled.
 * No gtag script is loaded until the visitor explicitly accepts.
 */
export function AnalyticsConsent() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const [consent, setConsent] = useState<AnalyticsConsentValue | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      setConsent(saved === 'granted' || saved === 'denied' ? saved : 'denied');
    } catch {
      // Storage can be blocked; fail closed and do not load analytics.
      setConsent('denied');
    }
  }, []);

  const choose = useCallback((value: AnalyticsConsentValue) => {
    setConsent(value);
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // The in-memory choice still applies for this page view.
    }
  }, []);

  if (!gaId) return null;

  const gaIdLiteral = JSON.stringify(gaId);

  return (
    <>
      {consent === 'granted' && (
        <>
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${gaIdLiteral}, { anonymize_ip: true, npa: true });`,
            }}
          />
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            strategy="afterInteractive"
          />
        </>
      )}

      {consent === null && (
        <aside
          role="region"
          aria-label="Analytics preferences"
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-2xl border border-line bg-surface p-4 text-ink shadow-2xl sm:left-auto sm:right-4 sm:mx-0"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-accent-cyan">
            Privacy preference
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            We use privacy-focused analytics to improve this site. No ad personalization.
            Declining keeps all interview and report data out of analytics.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose('granted')}
              className="rounded-lg bg-accent-blue px-3.5 py-2 text-xs font-bold text-on-brand transition hover:brightness-110 cursor-pointer"
            >
              Accept analytics
            </button>
            <button
              type="button"
              onClick={() => choose('denied')}
              className="rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-surface-2 cursor-pointer"
            >
              Decline
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
