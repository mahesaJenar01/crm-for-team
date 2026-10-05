import { describe, expect, it } from 'vitest';
import { gateway } from '../lib/gateway';
const origin = 'https://crm.example';
function request(
  route: string,
  method = 'POST',
  payload: unknown = {},
  cookie = '',
  source = origin,
) {
  return new Request(`${origin}/api/${route}`, {
    method,
    headers: { origin: source, 'content-type': 'application/json', cookie },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(payload),
  });
}
describe('browser gateway', () => {
  it('stores tokens in secure HttpOnly cookies and hides them in login JSON', async () => {
    const response = await gateway(request('auth/login'), {
      fetch: async () =>
        Response.json({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'user' } }),
    });
    expect(await response.json()).toEqual({ user: { id: 'user' } });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    cookies.forEach((cookie) => {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api');
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects cross-origin mutations, login CSRF, and unlisted endpoints', async () => {
    const fetcher = async () => {
      throw new Error('must not be called');
    };
    expect(
      (
        await gateway(request('auth/login', 'POST', {}, '', 'https://attacker.example'), {
          fetch: fetcher,
        })
      ).status,
    ).toBe(403);
    expect(
      (await gateway(request('users', 'DELETE', {}, 'crm_access=a', ''), { fetch: fetcher }))
        .status,
    ).toBe(403);
    expect((await gateway(request('auth/bootstrap'), { fetch: fetcher })).status).toBe(404);
    expect((await gateway(request('spks', 'DELETE'), { fetch: fetcher })).status).toBe(405);
  });
  it('forwards revision changes, access token and filters only to the configured API', async () => {
    const changes = { revision: 7, changes: { delivered: true } };
    const response = await gateway(
      request(
        'gateway?route=spks/item&id=abc',
        'PATCH',
        changes,
        'crm_access=private; crm_refresh=more-private',
      ),
      {
        apiUrl: 'https://api.example',
        fetch: async (url, init) => {
          expect(String(url)).toBe('https://api.example/api/spks/item?id=abc');
          expect(new Headers(init?.headers).get('authorization')).toBe('Bearer private');
          expect(new Headers(init?.headers).get('cookie')).toBeNull();
          expect(JSON.parse(String(init?.body))).toEqual(changes);
          return Response.json({ error: 'conflict' }, { status: 409 });
        },
      },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict' });
  });
  it('uses the cookie refresh token instead of accepting a token from browser JSON', async () => {
    await gateway(request('auth/refresh', 'POST', { refreshToken: 'forged' }, 'crm_refresh=real'), {
      fetch: async (_url, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'real' });
        return Response.json({
          accessToken: 'next-access',
          refreshToken: 'next-refresh',
          user: { id: 'user' },
        });
      },
    });
  });
  it('clears browser cookies on logout, password change and rejected refresh', async () => {
    for (const route of ['auth/logout', 'auth/password', 'auth/refresh']) {
      const status = route === 'auth/refresh' ? 401 : 200;
      const response = await gateway(request(route, 'POST', {}, 'crm_access=a; crm_refresh=r'), {
        fetch: async () => Response.json({ ok: true }, { status }),
      });
      expect(response.headers.getSetCookie()).toHaveLength(2);
      response.headers.getSetCookie().forEach((cookie) => expect(cookie).toContain('Max-Age=0'));
    }
  });
  it('keeps cookies on temporary upstream failure so the user can retry', async () => {
    const response = await gateway(request('auth/refresh', 'POST', {}, 'crm_refresh=r'), {
      fetch: async () => {
        throw new Error('offline');
      },
    });
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
  it('rejects malformed and oversized bodies', async () => {
    expect((await gateway(request('spks', 'POST', [], 'crm_access=a'))).status).toBe(400);
    expect(
      (await gateway(request('spks', 'POST', { note: 'x'.repeat(65000) }, 'crm_access=a'))).status,
    ).toBe(413);
  });
});
