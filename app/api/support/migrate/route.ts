import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';

type FreshdeskSettings = {
  domain?: string;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  notes?: string;
};

function parseFreshdeskFromSettings(settings: unknown): FreshdeskSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const freshdesk = (settings as { freshdesk?: FreshdeskSettings }).freshdesk;
  if (!freshdesk || typeof freshdesk !== 'object') return {};
  return {
    domain: typeof freshdesk.domain === 'string' ? freshdesk.domain : undefined,
    apiKeyConfigured: Boolean(freshdesk.apiKeyConfigured || freshdesk.apiKey),
    notes: typeof freshdesk.notes === 'string' ? freshdesk.notes : undefined,
  };
}

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: { settings: true },
  });
  return jsonOk(parseFreshdeskFromSettings(company?.settings));
});

export const PUT = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: { settings: true },
  });
  const current =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? { ...(company.settings as Record<string, unknown>) }
      : {};
  const existing = parseFreshdeskFromSettings(current);
  const next: FreshdeskSettings = { ...existing };

  if (typeof body.domain === 'string') {
    next.domain = body.domain.trim();
  }
  if (typeof body.notes === 'string') {
    next.notes = body.notes.trim();
  }
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    next.apiKey = body.apiKey.trim();
    next.apiKeyConfigured = true;
  }

  await prisma.company.update({
    where: { id: companyId! },
    data: { settings: { ...current, freshdesk: next } },
  });

  return jsonOk({
    domain: next.domain,
    apiKeyConfigured: Boolean(next.apiKeyConfigured),
    notes: next.notes,
  });
});
