import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

// GET /api/emails/drafts - Fetch all drafts for current user
export async function GET(request: NextRequest) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const drafts = await prisma.emailDraft.findMany({
      where: { 
        userId: user.id,
        status: 'DRAFT'
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error fetching email drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email drafts' },
      { status: 500 }
    );
  }
}

// POST /api/emails/drafts - Create/save a new draft
export async function POST(request: NextRequest) {
  try {
    await withModuleAccess('EMAIL_OUTREACH');
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { leadId, companyName, recipientEmail, contactName, subject, emailBody, tone } = body;

    if (!companyName || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Company name, subject, and body are required' },
        { status: 400 }
      );
    }

    const draft = await prisma.emailDraft.create({
      data: {
        userId: user.id,
        leadId,
        companyName,
        recipientEmail,
        contactName,
        subject,
        body: emailBody,
        tone,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error('Error creating email draft:', error);
    return NextResponse.json(
      { error: 'Failed to create email draft' },
      { status: 500 }
    );
  }
}
