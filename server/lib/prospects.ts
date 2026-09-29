import type { Actor } from './auth.js';

export const prospectSelect = `select id,consultant_id as "consultantId",name,want,stage,status,
 created_by as "createdBy",created_at as "createdAt",updated_at as "updatedAt" from prospect`;

export function canSeeProspect(actor: Actor, prospect: { consultantId: string; supervisorId?: string }): boolean {
  return actor.role === 'master' || (actor.role === 'consultant' && prospect.consultantId === actor.id) ||
    (actor.role === 'supervisor' && prospect.supervisorId === actor.id);
}
