import { describe, expect, it } from 'vitest';
import { shiftMonth, validPassword, activeConsultants, money } from '../src/utils';
import type { User } from '../src/types';
describe('CRM boundary rules', () => {
  it('formats large database amounts without floating-point rounding', () => {
    expect(money('9999999999999999.99')).toBe('Rp 9.999.999.999.999.999,99');
    expect(money('500000000.50')).toBe('Rp 500.000.000,5');
    expect(money(null)).toBe('Belum diisi');
  });
  it('moves between months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('checks bcrypt byte limits for Unicode passwords', () => {
    expect(validPassword('x'.repeat(12))).toBe(true);
    expect(validPassword('x'.repeat(11))).toBe(false);
    expect(validPassword('🙂'.repeat(19))).toBe(false);
    expect(validPassword('x'.repeat(73))).toBe(false);
  });
  it('allows orphan consultants but excludes inactive consultants and teams with inactive supervisors', () => {
    const actor: User = {
      id: 'm',
      username: 'm',
      displayName: 'M',
      role: 'master',
      supervisorId: null,
      mustChangePassword: false,
    };
    const users: User[] = [
      { ...actor, id: 's', role: 'supervisor', active: false },
      { ...actor, id: 'c', role: 'consultant', supervisorId: 's' },
      { ...actor, id: 'orphan', role: 'consultant' },
      { ...actor, id: 'inactive', role: 'consultant', active: false },
    ];
    expect(activeConsultants(users, actor).map((u) => u.id)).toEqual(['orphan']);
  });
});
