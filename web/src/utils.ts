import type { User } from './types';
export const roles = {
  master: 'Master',
  supervisor: 'Sales Supervisor',
  consultant: 'Sales Consultant',
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const currentMonth = () => today().slice(0, 7);
export const dateLabel = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(date.length === 10 ? `${date}T12:00:00+07:00` : date))
    : 'Belum diisi';
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${month}-01T12:00:00+07:00`));
export function shiftMonth(month: string, amount: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function money(value: string | null): string {
  const match = value?.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return 'Belum diisi';
  const fraction = match[2]?.replace(/0+$/, '');
  return `Rp ${new Intl.NumberFormat('id-ID').format(BigInt(match[1]))}${fraction ? `,${fraction}` : ''}`;
}
export function activeConsultants(users: User[], actor: User) {
  if (actor.role === 'consultant') return [actor];
  return users.filter(
    (user) =>
      user.role === 'consultant' &&
      user.active !== false &&
      (!user.supervisorId || users.some((s) => s.id === user.supervisorId && s.active !== false)),
  );
}
export const validPassword = (value: string) =>
  value.length >= 12 && new TextEncoder().encode(value).length <= 72;
export const carColors: Record<string, string[]> = {
  'JAECOO J5 PREMIUM': ['PRISTINE WHITE', 'JET BLACK', 'FOREST GREEN', 'IVORY GRAY'],
  'JAECOO J5 STANDAR': ['PRISTINE WHITE', 'JET BLACK'],
  'JAECOO J7 SHS': [
    'PRISTINE WHITE',
    'JET BLACK',
    'MOONLIGHT SILVER',
    'STONE GREY',
    'PRISTINE WHITE TWO TONE',
  ],
  'JAECOO J7 AWD': [
    'PRISTINE WHITE',
    'JET BLACK',
    'MOONLIGHT SILVER',
    'STONE GREY',
    'PRISTINE WHITE TWO TONE',
  ],
  'JAECOO J8 SHS ARDIS': [
    'PRISTINE WHITE TWO TONE',
    'JET BLACK',
    'LUNAR SILVER TWO TONE',
    'STONE GREY TWO TONE',
  ],
  'JAECOO J8 ARDIS': [
    'PRISTINE WHITE TWO TONE',
    'JET BLACK',
    'LUNAR SILVER TWO TONE',
    'STONE GREY TWO TONE',
  ],
};
