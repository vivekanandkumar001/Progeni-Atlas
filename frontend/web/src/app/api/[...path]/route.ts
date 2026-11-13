import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBackendBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.split(',')[0]?.trim();
  const base = envUrl || (process.env.NODE_ENV === 'production'
    ? 'https://api.progeni.live'
    : 'http://127.0.0.1:5000');
  return base.replace(/\/+$/, '');
}

/** Credentialed CORS is restricted to first-party origins. */
function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    const allowed = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes(origin)) return true;
    // First-party progeni.live subdomains (https only in production)
    if (hostname === 'progeni.live' || hostname.endsWith('.progeni.live')) {
      return process.env.NODE_ENV !== 'production' || protocol === 'https:';
    }
    // Local development
    if (process.env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Headers the browser must never be able to spoof (identity is JWT-only). */
const SPOOFABLE_HEADERS = new Set([
  'x-user-email',
  'x-user-id',
  'x-candidate-email',
  'x-candidate-id',
]);

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const subPath = path && path.length > 0 ? '/' + path.join('/') : '';
    const search = request.nextUrl.search || '';
    const backendBase = getBackendBase();
    const targetUrl = `${backendBase}/api${subPath}${search}`;

    const forwardHeaders = new Headers();
    // Copy incoming headers except host, framing, browser-spoofable identity
    // headers, and the Expect header (undici/native fetch rejects it → proxy 502).
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'content-length') return;
      if (SPOOFABLE_HEADERS.has(lower)) return;
      if (lower === 'expect') return;
      forwardHeaders.set(key, value);
    });

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'manual',
      cache: 'no-store',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const bodyBuffer = await request.arrayBuffer();
      if (bodyBuffer.byteLength > 0) {
        init.body = bodyBuffer;
      }
    }

    const backendRes = await fetch(targetUrl, init);

    const resHeaders = new Headers();
    backendRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      // Drop chunking, encoding, and set-cookie headers (handled below)
      if (
        lower !== 'content-encoding' &&
        lower !== 'content-length' &&
        lower !== 'transfer-encoding' &&
        lower !== 'set-cookie'
      ) {
        resHeaders.set(key, value);
      }
    });

    // Forward cookies safely without losing multiple Set-Cookie headers
    if (typeof backendRes.headers.getSetCookie === 'function') {
      const cookies = backendRes.headers.getSetCookie();
      for (const cookie of cookies) {
        resHeaders.append('set-cookie', cookie);
      }
    } else {
      const rawCookie = backendRes.headers.get('set-cookie');
      if (rawCookie) {
        resHeaders.set('set-cookie', rawCookie);
      }
    }

    // Credentialed CORS only for first-party origins
    const origin = request.headers.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      resHeaders.set('Access-Control-Allow-Origin', origin);
      resHeaders.set('Access-Control-Allow-Credentials', 'true');
      resHeaders.append('Vary', 'Origin');
    }

    // API responses are user-specific — never let them be cached
    resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error('[API Proxy Route Error]:', err);
    return NextResponse.json(
      {
        error: 'API Gateway Connection Error',
        message: 'Could not reach backend service. Please try again shortly.',
      },
      { status: 502 }
    );
  }
}

export {
  proxyRequest as GET,
  proxyRequest as POST,
  proxyRequest as PUT,
  proxyRequest as PATCH,
  proxyRequest as DELETE,
  proxyRequest as OPTIONS,
  proxyRequest as HEAD,
};
