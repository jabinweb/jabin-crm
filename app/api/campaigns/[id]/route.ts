import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

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
    return handleApiError(error);
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
    if (data.leadIds) {
      // Remove existing leads
      await prisma.emailCampaignLead.deleteMany({
        where: { campaignId: id },
      });

      // Add new leads
      if (data.leadIds.length > 0) {
        await prisma.emailCampaignLead.createMany({
          data: data.leadIds.map((leadId: string) => ({
            campaignId: id,
            leadId,
            status: 'PENDING',
          })),
        });

        // Update total recipients
        await prisma.emailCampaign.update({
          where: { id },
          data: { totalRecipients: data.leadIds.length },
        });
      }
    }

    return NextResponse.json(campaign);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error updating campaign:', error);
    }
    return handleApiError(error);
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
    return handleApiError(error);
  }
}
