/** Browser adapter: tokens never leave HttpOnly cookies; the existing API enforces roles. */
const routes: Record<string, string[]> = {
  'auth/login': ['POST'],
  'auth/refresh': ['POST'],
  'auth/logout': ['POST'],
  'auth/password': ['POST'],
  users: ['GET', 'POST', 'PATCH', 'DELETE'],
  spks: ['GET', 'POST'],
  'spks/item': ['GET', 'PATCH', 'DELETE'],
  prospects: ['GET', 'POST'],
  'prospects/item': ['GET', 'PATCH'],
};
const accessCookie = 'crm_access';
const refreshCookie = 'crm_refresh';
const json = (value: unknown, status = 200, headers = new Headers()) => {
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return Response.json(value, { status, headers });
};
function cookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.headers.get('cookie') ?? '').split(';').flatMap((part) => {
      const i = part.indexOf('=');
      if (i < 0) return [];
      try {
        return [[part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1))]];
      } catch {
        return [];
      }
    }),
  );
}
function setCookie(headers: Headers, name: string, value: string, age: number, secure: boolean) {
  headers.append(
    'set-cookie',
    `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`,
  );
}
function clear(headers: Headers, secure: boolean) {
  setCookie(headers, accessCookie, '', 0, secure);
  setCookie(headers, refreshCookie, '', 0, secure);
}

export async function gateway(
  request: Request,
  options: { apiUrl?: string; fetch?: typeof fetch } = {},
): Promise<Response> {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const route =
    url.pathname === '/api/gateway' ? (url.searchParams.get('route') ?? '') : url.pathname.slice(5);
  if (!routes[route]) return json({ error: 'Endpoint tidak ditemukan.' }, 404);
  if (!routes[route].includes(request.method))
    return json({ error: 'Metode tidak didukung.' }, 405);
  // Cookie authentication requires same-origin mutation requests, including login.
  if (request.method !== 'GET' && request.headers.get('origin') !== url.origin)
    return json({ error: 'Permintaan harus berasal dari website ini.' }, 403);
  const session = cookies(request);
  const headers = new Headers();
  let payload: unknown;
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'JSON diperlukan.' }, 415);
    const raw = await request.text();
    if (raw.length > 64_000) return json({ error: 'Permintaan terlalu besar.' }, 413);
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: 'JSON tidak valid.' }, 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return json({ error: 'Objek JSON diperlukan.' }, 400);
  }
  if (route === 'auth/refresh' || route === 'auth/logout') {
    if (!session[refreshCookie]) {
      clear(headers, secure);
      return json(
        route === 'auth/logout' ? { ok: true } : { error: 'Silakan masuk kembali.' },
        route === 'auth/logout' ? 200 : 401,
        headers,
      );
    }
    payload = { refreshToken: session[refreshCookie] };
  } else if (route !== 'auth/login' && !session[accessCookie]) {
    return json({ error: 'Sesi perlu diperbarui.' }, 401);
  }
  const upstream = new URL(
    options.apiUrl ?? process.env.CRM_API_URL ?? 'https://crm-for-team-server.vercel.app',
  );
  if (upstream.origin === url.origin)
    return json({ error: 'Konfigurasi server tidak valid.' }, 503);
  upstream.pathname = `/api/${route}`;
  upstream.search = url.search;
  upstream.searchParams.delete('route');
  const upstreamHeaders = new Headers({ accept: 'application/json' });
  if (session[accessCookie] && !['auth/login', 'auth/refresh', 'auth/logout'].includes(route))
    upstreamHeaders.set('authorization', `Bearer ${session[accessCookie]}`);
  if (payload !== undefined) upstreamHeaders.set('content-type', 'application/json');
  const agent = request.headers.get('user-agent');
  if (agent) upstreamHeaders.set('user-agent', agent);
  const ip = request.headers.get('x-forwarded-for');
  if (ip) upstreamHeaders.set('x-forwarded-for', ip);
  try {
    const response = await (options.fetch ?? fetch)(upstream, {
      method: request.method,
      headers: upstreamHeaders,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
      redirect: 'error',
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (response.ok && ['auth/login', 'auth/refresh'].includes(route)) {
      if (
        typeof data.accessToken !== 'string' ||
        typeof data.refreshToken !== 'string' ||
        !data.user
      )
        return json({ error: 'Respons login tidak valid.' }, 502);
      setCookie(headers, accessCookie, data.accessToken, 900, secure);
      setCookie(headers, refreshCookie, data.refreshToken, 34_560_000, secure);
      return json({ user: data.user }, response.status, headers);
    }
    if (
      (route === 'auth/logout' && response.ok) ||
      (route === 'auth/password' && response.ok) ||
      (route === 'auth/refresh' && response.status === 401)
    )
      clear(headers, secure);
    return json(data, response.status, headers);
  } catch {
    return json({ error: 'Tidak dapat menghubungi server. Coba lagi.' }, 502);
  }
}
