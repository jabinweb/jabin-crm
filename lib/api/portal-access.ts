import type { Session } from 'next-auth';

/** Who may read customer-scoped portal APIs (preview for staff, data for linked customers). */
export type PortalDataAccess =
    | { ok: false }
    | { ok: true; scope: 'customer'; customerId: string }
    | { ok: true; scope: 'staff' };

export function resolvePortalDataAccess(session: Session | null): PortalDataAccess {
    if (!session?.user?.id) return { ok: false };

    const { role, customerId } = session.user;

    if (role === 'CUSTOMER') {
        if (!customerId) return { ok: false };
        return { ok: true, scope: 'customer', customerId };
    }

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        return { ok: true, scope: 'staff' };
    }

    return { ok: false };
}

/** Shape returned by GET /api/portal/stats — safe default when staff has no customer scope. */
export const emptyPortalStats = {
    totalEquipment: 0,
    openTickets: 0,
    pendingWarranties: 0,
    recentTickets: [] as Array<{
        id: string;
        subject: string;
        status: string;
        priority: string;
        createdAt: string;
    }>,
    equipmentHealth: 95,
};
