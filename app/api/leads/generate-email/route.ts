import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateColdEmail, generateBulkEmails } from '@/lib/email/email-generator';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { leadIds, tone = 'professional' } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Lead IDs are required' }, { status: 400 });
    }

    // Fetch user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    });

    const userCompany = userProfile?.companyName || undefined;
    const userService = userProfile?.service || userProfile?.valueProposition || undefined;

    // Fetch leads from database
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        userId: session.user.id,
      },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        industry: true,
        website: true,
        address: true,
        email: true,
      },
    });

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads found' }, { status: 404 });
    }

    // Generate emails for all leads
    const emailDrafts = await Promise.all(
      leads.map(async (lead) => {
        const draft = await generateColdEmail(
          {
            companyName: lead.companyName,
            contactName: lead.contactName || undefined,
            industry: lead.industry || undefined,
            website: lead.website || undefined,
            address: lead.address || undefined,
            email: lead.email || undefined,
          },
          tone,
          userCompany,
          userService
        );

        return {
          leadId: lead.id,
          companyName: lead.companyName,
          recipientEmail: lead.email,
          contactName: lead.contactName,
          subject: draft.subject,
          body: draft.body,
          tone: draft.tone,
        };
      })
    );

    return NextResponse.json({ drafts: emailDrafts });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error generating emails:', error);
    return NextResponse.json(
      { error: 'Failed to generate emails' },
      { status: 500 }
    );
  }
}
