import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { buildPreview, isMigrationObject } from '@/lib/migration';

export const maxDuration = 30;

export const POST = withTenantRoute(async (request, { session }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const objectRaw = formData.get('object');
  const csvFile = formData.get('file');

  if (!isMigrationObject(objectRaw)) {
    return NextResponse.json(
      { error: 'object must be leads, customers, or tickets' },
      { status: 400 }
    );
  }

  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
  }

  try {
    const csvText = await csvFile.text();
    const preview = buildPreview(objectRaw, csvText);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to preview CSV' },
      { status: 400 }
    );
  }
});
