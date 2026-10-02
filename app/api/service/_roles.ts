import type { Session } from 'next-auth';
import { hasLegacyRole } from '@/lib/auth/permissions';

/** Roles that use field tools (matches the "Field tools" nav item). */
export function isFieldServiceUser(session: Session | null): boolean {
  return hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN');
}

/** Roles that manage technicians: approve expenses, record cash, see the whole team. */
export function isFieldServiceManager(session: Session | null): boolean {
  return hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER');
}
