import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { NotificationType } from '@prisma/client';
import { loadMembership } from '@/lib/messaging/service';

/** POST — mark the conversation read up to now, and clear its chat notification. */
export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });
  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      type: NotificationType.CHAT_MESSAGE,
      read: false,
      metadata: { path: ['conversationId'], equals: id },
    },
    data: { read: true },
  });
  return jsonOk({ ok: true });
});
