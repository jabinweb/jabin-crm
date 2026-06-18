import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { TenantError } from '@/lib/auth/company-membership';
import { buildUnifiedInbox } from '@/lib/support/unified-inbox';
import { resolveOptionalStaffCompanyScope } from '@/lib/tenant/scope-staff-query';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_INBOX');

    const companyId = await resolveOptionalStaffCompanyScope(session, req);
    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const channel = req.nextUrl.searchParams.get('channel') ?? 'all';
    const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();

    const { items, channelCounts } = await buildUnifiedInbox({
      companyId,
      channel,
    });

    const filtered = q
      ? items.filter(
          (i) =>
            i.subject.toLowerCase().includes(q) ||
            i.customerName.toLowerCase().includes(q) ||
            i.preview.toLowerCase().includes(q)
        )
      : items;

    return NextResponse.json({ items: filtered, channelCounts });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/support/inbox]', error);
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 });
  }
}
