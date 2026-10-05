import type { History, Page, Prospect, Spk, User } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let refreshing: Promise<User> | null = null;
async function raw<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers:
        payload === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError(
      0,
      'Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi.',
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(502, 'Respons server tidak valid. Coba lagi.');
  }
  if (!response.ok)
    throw new ApiError(response.status, String(data.error ?? `Server error (${response.status})`));
  return data as T;
}
async function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('crm-session', run) : run();
}
export function restoreSession(): Promise<User> {
  if (!refreshing)
    refreshing = withSessionLock(
      async () => (await raw<{ user: User }>('auth/refresh', 'POST', {})).user,
    ).finally(() => {
      refreshing = null;
    });
  return refreshing;
}
async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  try {
    return await raw<T>(path, method, payload);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      error.message === 'Password change required'
    )
      window.dispatchEvent(new Event('crm:password-required'));
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      await restoreSession();
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.status === 401)
        window.dispatchEvent(new Event('crm:unauthorized'));
      throw refreshError;
    }
    try {
      return await raw<T>(path, method, payload);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401 && path !== 'auth/password')
        window.dispatchEvent(new Event('crm:unauthorized'));
      throw retryError;
    }
  }
}
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
export function normalizeSpk(spk: Spk): Spk {
  // PostgreSQL date columns may be serialized as midnight ISO timestamps by pg.
  return {
    ...spk,
    date: spk.date.slice(0, 10),
    promiseFrom: spk.promiseFrom.slice(0, 10),
    promiseTo: spk.promiseTo.slice(0, 10),
    vinAllocated: spk.vinAllocated?.slice(0, 10) ?? null,
    deliveredDate: spk.deliveredDate?.slice(0, 10) ?? null,
    planDoDate: spk.planDoDate?.slice(0, 10) ?? null,
  };
}
export const api = {
  login: (username: string, password: string) =>
    withSessionLock(
      async () =>
        (await raw<{ user: User }>('auth/login', 'POST', { username: username.trim(), password }))
          .user,
    ),
  logout: () => withSessionLock(() => raw('auth/logout', 'POST', {})),
  password: (currentPassword: string, newPassword: string) =>
    request('auth/password', 'POST', { currentPassword, newPassword }),
  users: async () => (await request<{ users: User[] }>('users')).users,
  createUser: (values: Record<string, unknown>) => request('users', 'POST', values),
  accountAction: (id: string, action: string, password?: string) =>
    request('users', 'PATCH', { id, action, password }),
  deleteUser: (id: string) => request(`users?${query({ id })}`, 'DELETE'),
  spks: async (params: {
    month?: string;
    outstanding?: string;
    status?: string;
    page?: number;
  }) => {
    const data = await request<{ spks: Spk[]; total: number; page: number; pageSize: number }>(
      `spks?${query(params)}`,
    );
    return { ...data, items: data.spks.map(normalizeSpk) } as Page<Spk>;
  },
  spk: async (id: string) =>
    normalizeSpk((await request<{ spk: Spk }>(`spks/item?${query({ id })}`)).spk),
  createSpk: async (values: Record<string, unknown>) =>
    normalizeSpk((await request<{ spk: Spk }>('spks', 'POST', values)).spk),
  updateSpk: async (spk: Spk, changes: Record<string, unknown>) =>
    normalizeSpk(
      (
        await request<{ spk: Spk }>(`spks/item?${query({ id: spk.id })}`, 'PATCH', {
          revision: spk.revision,
          changes,
        })
      ).spk,
    ),
  deleteSpk: (id: string) => request(`spks/item?${query({ id })}`, 'DELETE'),
  prospects: async (params: {
    month?: string;
    status?: string;
    consultantId?: string;
    page?: number;
  }) => {
    const data = await request<{
      prospects: Prospect[];
      total: number;
      page: number;
      pageSize: number;
    }>(`prospects?${query(params)}`);
    return { ...data, items: data.prospects } as Page<Prospect>;
  },
  prospect: (id: string) =>
    request<{ prospect: Prospect; history: History[] }>(`prospects/item?${query({ id })}`),
  createProspect: (values: Record<string, unknown>) => request('prospects', 'POST', values),
  updateProspect: (id: string, changes: Record<string, unknown>) =>
    request(`prospects/item?${query({ id })}`, 'PATCH', changes),
};
export function friendly(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return 'Data sudah berubah atau sudah ada. Muat data terbaru sebelum mencoba lagi.';
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
}
