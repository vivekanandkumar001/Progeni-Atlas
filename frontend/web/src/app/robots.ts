import type { MetadataRoute } from 'next';

/**
 * Enterprise SEO & GEO (Generative Engine Optimization) Robots Directive.
 * Configured for Next.js 16 App Router (/robots.txt).
 *
 * Directives:
 * - Public marketing & documentation pages are open to search engines.
 * - Authenticated recruiter, candidate, super-admin, and internal API routes are protected.
 * - AI crawlers (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, etc.) are explicitly welcomed
 *   to crawl public marketing pages and llms.txt for generative search citations.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/pricing',
          '/services',
          '/career',
          '/contact',
          '/login',
          '/register',
          '/llms.txt',
          '/llms-full.txt',
        ],
        disallow: [
          '/api/',
          '/recruiter/',
          '/candidate/',
          '/super-admin/',
          '/admin/',
          '/companion/',
          '/team-invite/',
          '/verify-otp',
          '/forgot-password',
        ],
      },
      {
        userAgent: [
          'GPTBot',
          'PerplexityBot',
          'ClaudeBot',
          'Google-Extended',
          'Applebot-Extended',
          'cohere-ai',
          'OAI-SearchBot',
          'CCBot',
        ],
        allow: [
          '/',
          '/about',
          '/pricing',
          '/services',
          '/career',
          '/contact',
          '/llms.txt',
          '/llms-full.txt',
        ],
        disallow: [
          '/api/',
          '/recruiter/',
          '/candidate/',
          '/super-admin/',
          '/admin/',
          '/companion/',
        ],
      },
    ],
    sitemap: 'https://atlas.progeni.live/sitemap.xml',
    host: 'https://atlas.progeni.live',
  };
}

