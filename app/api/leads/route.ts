import { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma';
import { Prisma, LeadStatus, Priority } from '@prisma/client';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { handleApiError, ApiException } from '@/lib/api-error-handler';
import { guardAgentFeature } from '@/lib/api/subscription-guards';
import { withModuleAccess, afterLeadCreated } from '@/lib/api/module-guard';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import '@/types/auth';

const listHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
};

export const GET = withStaffRoute(async (req, { session }) => {
  await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');
  const { companyId, employeeId } = await resolveCompanyContextFromRequest(session, req);
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  if (!companyId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: listHeaders });
  }
  if (!employeeId && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: listHeaders });
  }

  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('query') || searchParams.get('search') || '';
  const statuses = searchParams.getAll('status') as LeadStatus[];
  const priorities = searchParams.getAll('priority') as Priority[];
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const where: Prisma.LeadWhereInput = {
    companyId,
    ...(statuses.length > 0 && {
      status: {
        in: statuses.filter((status): status is LeadStatus =>
          Object.values(LeadStatus).includes(status as LeadStatus)
        ),
      },
    }),
    ...(priorities.length > 0 && {
      priority: {
        in: priorities.filter((priority): priority is Priority =>
          Object.values(Priority).includes(priority as Priority)
        ),
      },
    }),
    ...(query && {
      OR: [
        { companyName: { contains: query, mode: 'insensitive' } },
        { contactName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    }),
    ...(!isAdmin && employeeId && { employeeId }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, image: true, email: true },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            employee: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        _count: {
          select: { activities: true, documents: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return new Response(
    JSON.stringify({
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      data: leads,
      meta: { total, page, limit, pageCount: Math.ceil(total / limit) || 1 },
    }),
    { headers: listHeaders }
  );
});

export async function POST(req: NextRequest) {
  try {
    const session = await withModuleAccess('LEADS', { quota: 'leads' });
    const { companyId, employeeId } = await resolveCompanyContextFromRequest(session, req);
    const userId = session?.user?.id;
    if (!employeeId || !userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await req.json();
    const { name, company, email, phone, status, priority, description, sourceType } = data;
    const companyName = (company?.trim() || name?.trim() || 'Unknown').trim();

    const lead = await prisma.lead.create({
      data: {
        name: name?.trim() || companyName,
        companyName,
        email: email?.trim(),
        phone: phone?.trim(),
        status,
        priority,
        description: description?.trim(),
        source: typeof data.source === 'string' && data.source.trim() ? data.source.trim() : 'MANUAL',
        ...(data.sourceType != null && data.sourceType !== '' ? { sourceType: data.sourceType } : {}),
        companyId,
        userId,
        employeeId,
      },
      include: {
        assignedTo: true,
        activities: {
          include: { employee: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await prisma.leadActivity.create({
      data: {
        activityType: 'NOTE',
        description: 'Lead created',
        lead: { connect: { id: lead.id } },
        employee: { connect: { id: employeeId } },
      },
    });

    await afterLeadCreated(session.user.id, {
      leadId: lead.id,
      companyId,
      summary: `Lead created: ${lead.companyName}`,
    });

    return jsonOk({ data: lead });
  } catch (error) {
    if (error instanceof ApiException) return handleApiError(error);
    return handleRouteError(error);
  }
}
