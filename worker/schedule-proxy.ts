const CACHE_TTL_SECONDS = 3600;
const ALLOWED_ORIGINS = new Set([
  'https://anatomy-pickles.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://anatomy-pickles.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function withHeaders(response: Response, request: Request, cacheStatus: string) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request))) headers.set(name, value);
  headers.set('X-Pickles-Cache', cacheStatus);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cacheKey(request: Request) {
  const url = new URL(request.url);
  url.pathname = '/schedule';
  url.search = '?include_past=1';
  return new Request(url.toString(), { method: 'GET' });
}

async function fetchSchedule(env: Env) {
  const origin = new URL(env.SCHEDULE_ORIGIN);
  origin.searchParams.set('include_past', '1');
  return fetch(origin.toString(), { headers: { Accept: 'application/json' } });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/schedule') return new Response('Not found', { status: 404 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });

    const key = cacheKey(request);
    const cache = caches.default;

    if (request.method === 'POST') {
      const originResponse = await fetch(env.SCHEDULE_ORIGIN, {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('Content-Type') || 'text/plain;charset=utf-8' },
        body: request.body,
      });
      if (originResponse.ok) ctx.waitUntil(cache.delete(key));
      return withHeaders(originResponse, request, 'BYPASS');
    }

    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) });

    const forceRefresh = url.searchParams.has('_ts');
    if (!forceRefresh) {
      const cached = await cache.match(key);
      if (cached) return withHeaders(cached, request, 'HIT');
    }

    const originResponse = await fetchSchedule(env);
    if (!originResponse.ok) return withHeaders(originResponse, request, 'ERROR');

    const headers = new Headers(originResponse.headers);
    headers.set('Cache-Control', `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}`);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.delete('Set-Cookie');
    const cacheable = new Response(originResponse.body, { status: originResponse.status, headers });
    ctx.waitUntil(cache.put(key, cacheable.clone()));
    return withHeaders(cacheable, request, forceRefresh ? 'REFRESH' : 'MISS');
  },
} satisfies ExportedHandler<Env>;
