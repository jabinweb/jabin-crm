import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleRouteError } from '@/lib/api/tenant-response';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { emailCampaignLeads: true },
        },
        emailCampaignLeads: {
          include: {
            lead: {
              select: {
                id: true,
                companyName: true,
                email: true,
                contactName: true,
              },
            },
          },
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!campaign || campaign.userId !== session.user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching campaign:', error);
    }
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { id } = await params;
    const data = await request.json();

    // Check if campaign exists and belongs to user
    const existingCampaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!existingCampaign || existingCampaign.userId !== session.user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow editing draft campaigns
    if (existingCampaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft campaigns can be edited' },
        { status: 400 }
      );
    }

    // Update campaign
    const campaign = await prisma.emailCampaign.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        emailTemplate: data.emailTemplate,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        replyTo: data.replyTo,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });

    // Update leads if provided
    if (Array.isArray(data.leadIds)) {
      // Only leads from the current workspace may be added as recipients.
      const { companyId } = await resolveCompanyContextFromRequest(session, request);
      const requestedIds = Array.from(
        new Set<string>(data.leadIds.filter((x: unknown) => typeof x === 'string'))
      );
      const leadIds = requestedIds.length
        ? (
            await prisma.lead.findMany({
              where: { id: { in: requestedIds }, companyId },
              select: { id: true },
            })
          ).map((l) => l.id)
        : [];

      // Remove existing leads
      await prisma.emailCampaignLead.deleteMany({
        where: { campaignId: id },
      });

      // Add new leads
      if (leadIds.length > 0) {
        await prisma.emailCampaignLead.createMany({
          data: leadIds.map((leadId: string) => ({
            campaignId: id,
            leadId,
            status: 'PENDING',
          })),
        });
      }

      // Update total recipients (also resets to 0 when all leads are removed)
      const updated = await prisma.emailCampaign.update({
        where: { id },
        data: { totalRecipients: leadIds.length },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(campaign);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error updating campaign:', error);
    }
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('EMAIL_OUTREACH');

    const { id } = await params;

    // Check if campaign exists and belongs to user
    const existingCampaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!existingCampaign || existingCampaign.userId !== session.user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow deleting draft campaigns
    if (existingCampaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft campaigns can be deleted' },
        { status: 400 }
      );
    }

    // Delete campaign (cascade will handle related records)
    await prisma.emailCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error deleting campaign:', error);
    }
    return handleRouteError(error);
  }
}
