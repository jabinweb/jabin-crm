import { NextResponse } from 'next/server';
import { withTenantRoute } from '@/lib/api/with-route';
import { unreadTotal } from '@/lib/messaging/service';

/** Total unread messages in this workspace — drives the Messages nav badge. */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const count = await unreadTotal(companyId, session.user.id);
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
});
