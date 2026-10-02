import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { leadScoringService } from '@/lib/crm/lead-scoring-service';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest, TenantError } from '@/lib/auth/company-membership';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Only score leads in the caller's workspace.
    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const lead = await prisma.lead.findFirst({
      where: { id: String(leadId), companyId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const score = await leadScoringService.calculateLeadScore(leadId);
    return NextResponse.json(score);
  } catch (error: any) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error calculating lead score:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
