import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client';

const PIPELINE_STAGES: { name: string; status: LeadStatus }[] = [
  { name: 'New', status: LeadStatus.NEW },
  { name: 'Contacted', status: LeadStatus.CONTACTED },
  { name: 'Qualified', status: LeadStatus.QUALIFIED },
  { name: 'Proposal', status: LeadStatus.PROPOSAL },
  { name: 'Negotiation', status: LeadStatus.NEGOTIATION },
  { name: 'Won', status: LeadStatus.WON },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.employeeId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const counts = await prisma.lead.groupBy({
      by: ['status'],
      where: { employeeId: session.user.employeeId },
      _count: true,
    });

    const countByStatus: Record<string, number> = {};
    for (const row of counts) {
      countByStatus[row.status] = row._count;
    }

    const stages = PIPELINE_STAGES.map(({ name, status }) => ({
      name,
      value: countByStatus[status] ?? 0,
    }));

    return new Response(JSON.stringify({ stages }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/employee/dashboard/pipeline]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
