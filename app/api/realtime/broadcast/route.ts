import { NextResponse } from 'next/server'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { publishRealtime } from '@/lib/realtime/hub'
import { REALTIME_EVENTS } from '@/lib/realtime/events'

/** Client-triggered board move broadcast for multi-agent sync. */
export const POST = withTenantRoute(async (request, { companyId, session }) => {
  const body = await request.json().catch(() => ({}))
  const entity = body.entity as string
  if (!['tickets', 'deals', 'leads'].includes(entity)) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })
  }
  // Only roles that work a board may announce moves on it (sales boards aren't
  // technicians'); clients refetch on this event, so spoofed moves cause churn.
  const role = session.user.role ?? ''
  if ((entity === 'deals' || entity === 'leads') && !['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (typeof body.id !== 'string' || !body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  await publishRealtime(
    REALTIME_EVENTS.BOARD_MOVED,
    companyId!,
    {
      entity,
      id: body.id,
      from: body.from,
      to: body.to,
    },
    session.user.id
  )
  return jsonOk({ ok: true })
})
