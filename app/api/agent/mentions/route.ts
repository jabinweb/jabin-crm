import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { prisma } from '@/lib/prisma';

export type MentionSuggestion = {
  id: string;
  type: 'employee' | 'user' | 'customer';
  label: string;
  subtitle: string;
  email?: string | null;
  /** Prefer this when messaging / resolving */
  employeeId?: string | null;
  userId?: string | null;
  customerId?: string | null;
};

/**
 * Real-time @mention search across company employees, CRM users, and customers.
 * GET /api/agent/mentions?q=pri
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'OPS is for CRM staff' }, { status: 403 });
    }

    const ctx = await resolveCompanyContextFromRequest(session, req);
    const q = (new URL(req.url).searchParams.get('q') || '').trim();
    const limit = 8;

    if (q.length < 1) {
      // Empty query after @: show recent / top teammates + customers
      const [employees, customers] = await Promise.all([
        prisma.employee.findMany({
          where: {
            companyId: ctx.companyId,
            status: { in: ['ACTIVE', 'ON_LEAVE', 'PENDING'] },
          },
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
            department: true,
            userId: true,
          },
          orderBy: { name: 'asc' },
          take: limit,
        }),
        prisma.customer.findMany({
          where: { companyId: ctx.companyId },
          select: {
            id: true,
            organizationName: true,
            contactPerson: true,
            email: true,
          },
          orderBy: { organizationName: 'asc' },
          take: Math.min(4, limit),
        }),
      ]);

      const results: MentionSuggestion[] = [
        ...employees.map((e) => ({
          id: `employee:${e.id}`,
          type: 'employee' as const,
          label: e.name,
          subtitle: [e.jobTitle, e.department].filter(Boolean).join(' · ') || e.email,
          email: e.email,
          employeeId: e.id,
          userId: e.userId,
        })),
        ...customers.map((c) => ({
          id: `customer:${c.id}`,
          type: 'customer' as const,
          label: c.organizationName,
          subtitle: c.contactPerson
            ? `${c.contactPerson}${c.email ? ` · ${c.email}` : ''}`
            : c.email || 'Customer',
          email: c.email,
          customerId: c.id,
        })),
      ];

      return NextResponse.json({ results: results.slice(0, limit) });
    }

    const [employees, users, customers] = await Promise.all([
      prisma.employee.findMany({
        where: {
          companyId: ctx.companyId,
          status: { in: ['ACTIVE', 'ON_LEAVE', 'PENDING'] },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { jobTitle: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          department: true,
          userId: true,
        },
        take: limit,
      }),
      prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { primaryCompanyId: ctx.companyId },
                { companyId: ctx.companyId },
                { userCompanies: { some: { companyId: ctx.companyId } } },
              ],
            },
            { role: { notIn: ['CUSTOMER'] } },
            {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          employeeProfile: { select: { id: true } },
        },
        take: limit,
      }),
      prisma.customer.findMany({
        where: {
          companyId: ctx.companyId,
          OR: [
            { organizationName: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          organizationName: true,
          contactPerson: true,
          email: true,
        },
        take: limit,
      }),
    ]);

    const seen = new Set<string>();
    const results: MentionSuggestion[] = [];

    const push = (item: MentionSuggestion) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      results.push(item);
    };

    for (const e of employees) {
      push({
        id: `employee:${e.id}`,
        type: 'employee',
        label: e.name,
        subtitle: [e.jobTitle, e.department].filter(Boolean).join(' · ') || e.email,
        email: e.email,
        employeeId: e.id,
        userId: e.userId,
      });
    }

    for (const u of users) {
      // Prefer employee row if already listed
      if (u.employeeProfile?.id && seen.has(`employee:${u.employeeProfile.id}`)) continue;
      push({
        id: `user:${u.id}`,
        type: 'user',
        label: u.name || u.email,
        subtitle: `${u.role}${u.email ? ` · ${u.email}` : ''}`,
        email: u.email,
        userId: u.id,
        employeeId: u.employeeProfile?.id ?? null,
      });
    }

    for (const c of customers) {
      push({
        id: `customer:${c.id}`,
        type: 'customer',
        label: c.organizationName,
        subtitle: c.contactPerson
          ? `${c.contactPerson}${c.email ? ` · ${c.email}` : ''}`
          : c.email || 'Customer / client',
        email: c.email,
        customerId: c.id,
      });
    }

    return NextResponse.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error('[api/agent/mentions]', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
