import type { Session } from 'next-auth';

const SUPPORT_STAFF_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'SUPPORT_MANAGER',
  'TECHNICIAN',
]);

export function isSupportStaff(session: Session | null): boolean {
  const role = session?.user?.role;
  return !!role && SUPPORT_STAFF_ROLES.has(role);
}

export function isSupportAdmin(session: Session | null): boolean {
  const role = session?.user?.role;
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPPORT_MANAGER';
}
