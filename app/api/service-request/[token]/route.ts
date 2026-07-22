import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveServiceRequestToken } from '@/lib/service-request/tokens';
import { createPortalTicket } from '@/lib/support/create-portal-ticket';
import { resolveCompanyTicketConfig } from '@/lib/support/resolve-company-ticket-config';
import { consumeRateLimit, rateLimitKeyFromIp } from '@/lib/rate-limit-store';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const scope = await resolveServiceRequestToken(token);
  if (!scope) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: scope.customerId },
    select: {
      id: true,
      organizationName: true,
      companyId: true,
      equipmentInstallations:
        scope.kind === 'customer'
          ? {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                serialNumber: true,
                product: { select: { name: true, modelNumber: true } },
              },
              orderBy: { installationDate: 'desc' },
              take: 50,
            }
          : false,
    },
  });

  if (!customer) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  let equipment: {
    id: string;
    serialNumber: string | null;
    product: { name: string; modelNumber: string | null };
  } | null = null;

  if (scope.kind === 'equipment') {
    equipment = await prisma.equipmentInstallation.findUnique({
      where: { id: scope.equipmentId },
      select: {
        id: true,
        serialNumber: true,
        product: { select: { name: true, modelNumber: true } },
      },
    });
  }

  const { ticketTypes, config } = await resolveCompanyTicketConfig(customer.companyId);

  return NextResponse.json({
    organizationName: customer.organizationName,
    lockedEquipmentId: scope.kind === 'equipment' ? scope.equipmentId : null,
    equipment,
    equipmentOptions:
      scope.kind === 'customer'
        ? (customer.equipmentInstallations as Array<{
            id: string;
            serialNumber: string | null;
            product: { name: string; modelNumber: string | null };
          }>)
        : equipment
          ? [equipment]
          : [],
    ticketTypes,
    terminology: {
      ticket: config.terminology.ticket ?? 'service request',
      equipment: config.terminology.equipment ?? 'equipment',
    },
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anon';
  const key = rateLimitKeyFromIp(ip, `/api/service-request/${token.slice(0, 8)}`);
  const allowed = await consumeRateLimit(key, { maxRequests: 15, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    );
  }

  const scope = await resolveServiceRequestToken(token);
  if (!scope) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const ticketType = typeof body.ticketType === 'string' ? body.ticketType : '';
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
  const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';
  const equipmentId =
    scope.kind === 'equipment'
      ? scope.equipmentId
      : typeof body.equipmentId === 'string'
        ? body.equipmentId
        : undefined;

  if (!subject || !description || !ticketType) {
    return NextResponse.json(
      { error: 'Please fill in the issue type, subject, and description.' },
      { status: 400 }
    );
  }

  const notes = [
    contactName ? `Reported by: ${contactName}` : null,
    contactPhone ? `Phone: ${contactPhone}` : null,
    description,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ticket = await createPortalTicket(scope.customerId, {
      ticketType,
      subject,
      description: notes,
      equipmentId,
      priority: typeof body.priority === 'string' ? (body.priority as any) : undefined,
      customFields:
        body.customFields && typeof body.customFields === 'object'
          ? (body.customFields as Record<string, string>)
          : undefined,
    });

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      message: 'Your service request was submitted. Our team will follow up shortly.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
