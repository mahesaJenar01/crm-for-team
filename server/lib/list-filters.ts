import type { Actor } from './auth.js';
import { ApiError, oneOf, uuid } from './http.js';

export function listFilters(actor: Actor, params: URLSearchParams, kind: 'spk' | 'prospect') {
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (value: unknown, expression: (parameter: string) => string) => {
    values.push(value);
    where.push(expression(`$${values.length}`));
  };
  if (actor.role === 'consultant') add(actor.id, (p) => `consultant_id=${p}`);
  if (actor.role === 'supervisor') add(actor.id, (p) => kind === 'spk'
    ? `supervisor_id=${p}` : `consultant_id in (select id from app_user where supervisor_id=${p})`);
  const month = params.get('month');
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, 'month must be YYYY-MM');
  const outstanding = kind === 'spk' && params.get('outstanding') === 'true';
  if (month && !outstanding) add(`${month}-01`, (p) => kind === 'spk'
    ? `spk_date >= ${p}::date and spk_date < (${p}::date + interval '1 month')`
    : `(created_at at time zone 'Asia/Jakarta') >= ${p}::date and (created_at at time zone 'Asia/Jakarta') < (${p}::date + interval '1 month')`);
  const status = params.get('status') ?? 'all';
  if (kind === 'spk') {
    oneOf(status, 'status', ['all', 'open', 'closed', 'cancelled'] as const);
    if (outstanding) where.push("status='open'");
    else if (status !== 'all') add(status, (p) => `status=${p}`);
  } else {
    oneOf(status, 'status', ['all', 'running', 'completed'] as const);
    if (status === 'running') where.push("status='pending'");
    if (status === 'completed') where.push("status in ('berhasil','gagal')");
    const consultantId = params.get('consultantId');
    if (consultantId) add(uuid(consultantId, 'consultantId'), (p) => `consultant_id=${p}`);
  }
  return { clause: where.length ? ` where ${where.join(' and ')}` : '', values };
}
