export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export function handle(run: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try { return await run(request); }
    catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: 'Invalid JSON body' }, 400);
      const dbCode = (error as { code?: string })?.code;
      if (dbCode === '23505') return json({ error: 'This value is already in use' }, 409);
      if (dbCode === '23503' || dbCode === '23514' || dbCode === '22P02') return json({ error: 'Invalid or conflicting data' }, 400);
      console.error(error);
      return json({ error: 'Internal server error' }, 500);
    }
  };
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'Content-Type must be application/json');
  }
  const raw = await request.text();
  if (raw.length > 64_000) throw new ApiError(413, 'Request body too large');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'JSON object required');
  return value as Record<string, unknown>;
}

export function string(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, `${name} is required or too long`);
  return value.trim();
}

export function optionalString(value: unknown, name: string, max = 200): string | null {
  if (value === undefined || value === null || value === '') return null;
  return string(value, name, max);
}

export function oneOf<T extends string>(value: unknown, name: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new ApiError(400, `Invalid ${name}`);
  return value as T;
}

export function uuid(value: unknown, name = 'id'): string {
  const result = string(value, name, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new ApiError(400, `Invalid ${name}`);
  return result;
}

export function date(value: unknown, name: string): string {
  const result = string(value, name, 10);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new ApiError(400, `Invalid ${name}`);
  return result;
}

export function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new ApiError(400, `Invalid ${name}`);
  return value;
}

export function integer(value: unknown, name: string, min = 0, max = 1_000_000): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new ApiError(400, `Invalid ${name}`);
  return value as number;
}

export function ip(request: Request): string {
  return (request.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim().slice(0, 100);
}

export function userAgent(request: Request): string {
  return (request.headers.get('user-agent') ?? '').slice(0, 500);
}
