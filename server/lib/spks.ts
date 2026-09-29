import type { Db } from './db.js';
import type { Actor } from './auth.js';
import { ApiError, boolean, date, integer, oneOf, optionalString, string, uuid } from './http.js';

export const spkSelect = `select id,spk_number as "number",spk_date as "date",customer_name as "customerName",
 consultant_id as "consultantId",supervisor_id as "supervisorId",client_type as "clientType",phone,
 car_type as "carType",color,quantity,deal_price as "dealPrice",same_as_otr as "sameAsOtr",payment,
 tenor_months as "tenorMonths",tdp,insurance,description,bonus,promise_from as "promiseFrom",promise_to as "promiseTo",
 status,crm_done as "crmDone",vin,vin_allocated as "vinAllocated",delivered,delivered_date as "deliveredDate",
 fully_paid as "fullyPaid",delivery_planned as "deliveryPlanned",refund_credit as "refundCredit",
 incentive_dms as "incentiveDms",incentive_csi as "incentiveCsi",revision,created_at as "createdAt",updated_at as "updatedAt" from spk`;

export function canSeeSpk(actor: Actor, spk: { consultantId: string; supervisorId: string }): boolean {
  return actor.role === 'master' || (actor.role === 'supervisor' && spk.supervisorId === actor.id) || (actor.role === 'consultant' && spk.consultantId === actor.id);
}

export async function consultantForSpk(db: Db, actor: Actor, requested: unknown): Promise<{ consultantId: string; supervisorId: string }> {
  const consultantId = actor.role === 'consultant' ? actor.id : uuid(requested, 'consultantId');
  const { rows } = await db.query("select c.id,c.supervisor_id from app_user c join app_user s on s.id=c.supervisor_id where c.id=$1 and c.role='consultant' and c.active=true and s.active=true", [consultantId]);
  if (!rows.length || !rows[0].supervisor_id) throw new ApiError(400, 'Active consultant with supervisor required');
  if (actor.role === 'supervisor' && rows[0].supervisor_id !== actor.id) throw new ApiError(403, 'Consultant is outside your team');
  return { consultantId, supervisorId: rows[0].supervisor_id };
}

export function money(value: unknown, name: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,16}(\.\d{1,2})?$/.test(String(value))) throw new ApiError(400, `Invalid ${name}`);
  return String(value);
}

export function validateSpkChanges(input: Record<string, unknown>, role: Actor['role']): Record<string, unknown> {
  const columns: Record<string, string> = {
    number: 'spk_number', date: 'spk_date', customerName: 'customer_name', clientType: 'client_type', phone: 'phone',
    carType: 'car_type', color: 'color', quantity: 'quantity', dealPrice: 'deal_price', sameAsOtr: 'same_as_otr',
    payment: 'payment', tenorMonths: 'tenor_months', tdp: 'tdp', insurance: 'insurance', description: 'description',
    bonus: 'bonus', promiseFrom: 'promise_from', promiseTo: 'promise_to', status: 'status', crmDone: 'crm_done',
    vin: 'vin', vinAllocated: 'vin_allocated', delivered: 'delivered', deliveredDate: 'delivered_date',
    fullyPaid: 'fully_paid', deliveryPlanned: 'delivery_planned', refundCredit: 'refund_credit',
    incentiveDms: 'incentive_dms', incentiveCsi: 'incentive_csi',
  };
  const protectedFields = new Set(['status', 'vin', 'vinAllocated', 'delivered', 'deliveredDate', 'fullyPaid', 'deliveryPlanned', 'refundCredit', 'incentiveDms', 'incentiveCsi']);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(key in columns)) throw new ApiError(400, `Unknown SPK field: ${key}`);
    if (role === 'consultant' && protectedFields.has(key)) throw new ApiError(403, `Cannot edit ${key}`);
    const column = columns[key];
    if (['number', 'customerName', 'phone', 'carType', 'color', 'bonus'].includes(key)) output[column] = string(value, key, 300);
    else if (['date', 'promiseFrom', 'promiseTo'].includes(key)) output[column] = date(value, key);
    else if (key === 'deliveredDate' || key === 'vinAllocated') output[column] = value === null ? null : date(value, key);
    else if (key === 'clientType') output[column] = oneOf(value, key, ['retail', 'fleet'] as const);
    else if (key === 'payment') output[column] = oneOf(value, key, ['cash', 'credit', 'cop'] as const);
    else if (key === 'status') output[column] = oneOf(value, key, ['open', 'closed', 'cancelled'] as const);
    else if (key === 'quantity') output[column] = integer(value, key, 1, 10000);
    else if (key === 'tenorMonths') output[column] = value === null ? null : integer(value, key, 1, 600);
    else if (key === 'dealPrice' || key === 'tdp') output[column] = money(value, key);
    else if (['sameAsOtr', 'crmDone', 'delivered', 'fullyPaid', 'deliveryPlanned', 'refundCredit', 'incentiveDms', 'incentiveCsi'].includes(key)) output[column] = boolean(value, key);
    else output[column] = optionalString(value, key, 2000);
  }
  return output;
}

export function validateSpkState(spk: { promiseFrom: string; promiseTo: string; payment: string; tenorMonths: number | null; tdp: string | null; delivered: boolean; status: string; deliveredDate: string | null }): void {
  if (spk.promiseTo < spk.promiseFrom) throw new ApiError(400, 'Promise end date must be on or after start date');
  if (spk.payment === 'credit' && (spk.tenorMonths === null || spk.tdp === null)) throw new ApiError(400, 'Credit SPK requires tenorMonths and tdp');
  if (spk.delivered && (spk.status !== 'closed' || !spk.deliveredDate)) throw new ApiError(400, 'Delivered SPK must be closed and have deliveredDate');
  if (spk.status === 'cancelled' && spk.delivered) throw new ApiError(400, 'Delivered SPK cannot be cancelled');
}
