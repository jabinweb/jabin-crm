import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import {
  isMigrationObject,
  runImport,
  type ColumnMapping,
  type MigrationObject,
} from '@/lib/migration';

export const maxDuration = 60;
export const runtime = 'nodejs';

export const POST = withTenantRoute(async (request, { session, companyId, userId, employeeId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const objectRaw = formData.get('object');
  const csvFile = formData.get('file');
  const mappingRaw = formData.get('mapping');
  const createMissingRaw = formData.get('createMissingCustomers');

  if (!isMigrationObject(objectRaw)) {
    return NextResponse.json(
      { error: 'object must be leads, customers, or tickets' },
      { status: 400 }
    );
  }

  const object = objectRaw as MigrationObject;

  if (object === 'tickets') {
    try {
      await ensureFeatureEnabled(userId, 'TICKETS');
    } catch {
      return NextResponse.json(
        { error: 'Tickets module is not enabled for this workspace' },
        { status: 403 }
      );
    }
  }

  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
  }

  let mapping: ColumnMapping | null = null;
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw) as ColumnMapping;
    } catch {
      return NextResponse.json({ error: 'Invalid mapping JSON' }, { status: 400 });
    }
  }

  const createMissingCustomers =
    createMissingRaw === 'true' || createMissingRaw === '1';

  try {
    const csvText = await csvFile.text();
    const result = await runImport({
      object,
      csvText,
      mapping,
      ctx: { companyId, userId, employeeId },
      options: { createMissingCustomers },
    });

    return NextResponse.json({
      ...result,
      createdLeadIds: object === 'leads' ? result.createdIds : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed';
    const status = message.includes('limit') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
