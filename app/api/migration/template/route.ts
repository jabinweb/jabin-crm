import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { isMigrationObject, templateCsvForObject } from '@/lib/migration';

export const GET = withTenantRoute(async (request, { session }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const object = new URL(request.url).searchParams.get('object');
  if (!isMigrationObject(object)) {
    return NextResponse.json(
      { error: 'Query object must be leads, customers, or tickets' },
      { status: 400 }
    );
  }

  const csv = templateCsvForObject(object);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="opslane-${object}-template.csv"`,
    },
  });
});
