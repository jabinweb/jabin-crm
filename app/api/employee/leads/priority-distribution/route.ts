import { prisma } from '@/lib/prisma';
import { Priority } from '@prisma/client';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireEmployeeModule } from '@/lib/api/employee-guard';

export async function GET() {
  try {
    const session = await requireEmployeeModule('LEADS');

    const rows = await prisma.lead.groupBy({
      by: ['priority'],
      where: { employeeId: session.user.employeeId },
      _count: true,
    });

    const distribution = Object.values(Priority).reduce<Record<Priority, number>>(
      (acc, priority) => {
        acc[priority] = 0;
        return acc;
      },
      {} as Record<Priority, number>
    );

    for (const row of rows) {
      distribution[row.priority] = row._count;
    }

    return new Response(JSON.stringify(distribution), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/employee/leads/priority-distribution]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
