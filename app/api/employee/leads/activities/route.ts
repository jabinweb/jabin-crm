import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireEmployeeModule } from '@/lib/api/employee-guard';

export async function GET() {
  try {
    const session = await requireEmployeeModule('LEADS');

    const activities = await prisma.leadActivity.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        employee: {
          select: { id: true, name: true, avatar: true },
        },
        lead: {
          select: { id: true, companyName: true },
        },
      },
    });

    const normalized = activities.map((activity) => ({
      id: activity.id,
      type: activity.activityType,
      description: activity.description,
      createdAt: activity.createdAt,
      employee: activity.employee,
      lead: activity.lead,
    }));

    return new Response(JSON.stringify(normalized), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/employee/leads/activities]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
