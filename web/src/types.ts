export type Role = 'master' | 'supervisor' | 'consultant';
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  supervisorId: string | null;
  active?: boolean;
  mustChangePassword: boolean;
  currentMonthSpks?: number;
  runningProspects?: number;
}
export interface Spk {
  id: string;
  number: string;
  date: string;
  customerName: string;
  consultantId: string;
  supervisorId: string | null;
  consultantName: string | null;
  supervisorName: string | null;
  clientType: 'retail' | 'fleet';
  phone: string;
  carType: string;
  color: string;
  quantity: number;
  dealPrice: string | null;
  sameAsOtr: boolean;
  payment: 'cash' | 'credit' | 'cop';
  tenorMonths: number | null;
  tdp: string | null;
  insurance: string | null;
  description: string | null;
  bonus: string;
  promiseFrom: string;
  promiseTo: string;
  status: 'open' | 'closed' | 'cancelled';
  crmDone: boolean;
  vin: string | null;
  vinAllocated: string | null;
  delivered: boolean;
  deliveredDate: string | null;
  fullyPaid: boolean;
  deliveryPlanned: boolean;
  planDoDate: string | null;
  refundCredit: boolean;
  incentiveDms: boolean;
  incentiveCsi: boolean;
  revision: number;
}
export interface Prospect {
  id: string;
  consultantId: string;
  name: string;
  want: string;
  stage: string;
  status: 'pending' | 'berhasil' | 'gagal';
  createdAt?: string;
}
export interface History {
  id: string;
  want: string;
  stage: string;
  createdAt: string;
}
export interface Page<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}
