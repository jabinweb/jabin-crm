import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ActivityType, LeadStatus } from '@prisma/client';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

function resolveLeadEmail(lead: { id: string; email: string | null; phone: string | null }) {
  if (lead.email?.trim()) return lead.email.trim().toLowerCase();
  if (lead.phone?.trim()) return `lead.${lead.id}@phone.local`;
  return `lead.${lead.id}@noemail.local`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.convertedClientId) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { companyId, email: { equals: resolveLeadEmail(lead), mode: 'insensitive' } },
      });
      return NextResponse.json(
        {
          error: 'Lead already converted',
          clientId: lead.convertedClientId,
          customerId: existingCustomer?.id,
        },
        { status: 400 }
      );
    }

    const email = resolveLeadEmail(lead);
    const contactName = lead.contactName || lead.name || lead.companyName;

    const result = await prisma.$transaction(async (tx) => {
      let client = await tx.client.findFirst({
        where: { email, companyId },
      });

      if (!client) {
        const globalClient = await tx.client.findUnique({ where: { email } });
        const clientEmail =
          globalClient && globalClient.companyId !== companyId
            ? `lead.${lead.id}.${companyId}@tenant.local`
            : email;

        client = await tx.client.create({
          data: {
            name: lead.companyName,
            contact: contactName,
            email: clientEmail,
            phone: lead.phone || '',
            address: {
              street: lead.address ?? '',
              city: lead.city ?? '',
              state: lead.state ?? '',
              country: lead.country ?? '',
              zipCode: lead.zipCode ?? '',
            },
            companyId,
          },
        });
      }

      let customer = await tx.customer.findFirst({
        where: {
          companyId,
          OR: [
            { email: { equals: email, mode: 'insensitive' } },
            { organizationName: lead.companyName, contactPerson: contactName },
          ],
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            organizationName: lead.companyName,
            contactPerson: contactName,
            email: email.includes('@noemail.local') || email.includes('@phone.local') ? undefined : email,
            phone: lead.phone ?? undefined,
            address: lead.address ?? undefined,
            city: lead.city ?? undefined,
            state: lead.state ?? undefined,
            industry: lead.industry ?? undefined,
            companyId,
            notes: lead.notes ?? undefined,
          },
        });
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedAt: new Date(),
          convertedClientId: client.id,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          activityType: ActivityType.STATUS_CHANGED,
          description: `Converted to customer account (${customer.organizationName})`,
          userId: session.user!.id,
          metadata: { customerId: customer.id, clientId: client.id },
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId: customer.id,
          eventType: 'UPDATED',
          description: `Created from lead conversion (${lead.companyName})`,
          metadata: { leadId: lead.id },
        },
      });

      return { client, customer };
    });

    return NextResponse.json(
      {
        ...result.client,
        customer: result.customer,
        customerId: result.customer.id,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/leads/[id]/convert POST]', error);
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
