import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute } from '@/lib/api/with-route';

/** POST /api/chats/[userId]/read — mark that teammate's messages to me as read. */
export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const otherId = (await routeContext!.params).id;

  const result = await prisma.directMessage.updateMany({
    where: { companyId, senderId: otherId, receiverId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true, marked: result.count });
});
