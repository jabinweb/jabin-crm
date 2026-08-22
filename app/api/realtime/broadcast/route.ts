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
