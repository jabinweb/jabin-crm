import { NextRequest } from 'next/server';
import { LeadStatus, CompanyTaskPriority } from '@prisma/client';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(req: NextRequest) {
  try {
    await withModuleAccess('LEADS');

    const metadata = {
      statuses: Object.values(LeadStatus).map(status => ({
        label: status.toLowerCase(),
        value: status
      })),
      priorities: Object.values(CompanyTaskPriority).map(priority => ({
        label: priority.toLowerCase(),
        value: priority
      })),
      sources: [
        { label: "Website", value: "WEBSITE" },
        { label: "Referral", value: "REFERRAL" },
        { label: "Direct", value: "DIRECT" },
        { label: "Social", value: "SOCIAL" }
      ]
    };

    return new Response(JSON.stringify(metadata), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching metadata:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
