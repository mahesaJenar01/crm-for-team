import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, normalizeSpk } from '../src/api';
import type { Spk } from '../src/types';
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('browser API boundary', () => {
  it('normalizes PostgreSQL dates for HTML date controls without changing amounts', () => {
    const spk = {
      date: '2026-10-05T00:00:00.000Z',
      promiseFrom: '2026-10-06',
      promiseTo: '2026-10-09T00:00:00.000Z',
      vinAllocated: null,
      deliveredDate: null,
      planDoDate: '2026-10-07T00:00:00.000Z',
      dealPrice: '9999999999999999.99',
    } as Spk;
    const result = normalizeSpk(spk);
    expect(result.date).toBe('2026-10-05');
    expect(result.promiseTo).toBe('2026-10-09');
    expect(result.planDoDate).toBe('2026-10-07');
    expect(result.vinAllocated).toBeNull();
    expect(result.dealPrice).toBe(spk.dealPrice);
  });
  it('shares one rotating refresh across simultaneous expired data requests', async () => {
    let valid = false;
    let refreshCount = 0;
    vi.stubGlobal('navigator', {
      locks: { request: (_name: string, run: () => Promise<unknown>) => run() },
    });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        valid = true;
        return Response.json({ user: { id: 'u' } });
      }
      if (!valid) return Response.json({ error: 'expired' }, { status: 401 });
      return Response.json({ users: [] });
    });
    await Promise.all([api.users(), api.users(), api.users()]);
    expect(refreshCount).toBe(1);
  });
});
