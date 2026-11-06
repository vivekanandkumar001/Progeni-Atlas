import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBackendBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.split(',')[0]?.trim();
  const base = envUrl || (process.env.NODE_ENV === 'production'
    ? 'https://api-atlas.progeni.live'
    : 'http://127.0.0.1:5000');
  return base.replace(/\/+$/, '');
}

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const subPath = path && path.length > 0 ? '/' + path.join('/') : '';
    const search = request.nextUrl.search || '';
    const backendBase = getBackendBase();
    const targetUrl = `${backendBase}/api${subPath}${search}`;

    const forwardHeaders = new Headers();
    // Copy incoming headers except host
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'content-length') {
        forwardHeaders.set(key, value);
      }
    });

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'manual',
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
      // Drop chunking and encoding headers that Node.js / Vercel handles natively
      if (lower !== 'content-encoding' && lower !== 'content-length' && lower !== 'transfer-encoding') {
        resHeaders.set(key, value);
      }
    });

    // Ensure CORS headers for browser compatibility
    const origin = request.headers.get('origin');
    if (origin) {
      resHeaders.set('Access-Control-Allow-Origin', origin);
      resHeaders.set('Access-Control-Allow-Credentials', 'true');
    }

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
        detail: err instanceof Error ? err.message : String(err),
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

