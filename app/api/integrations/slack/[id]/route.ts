import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { encryptSlackWebhookUrl, postToSlackWebhook } from '@/lib/integrations/slack';
import { isSlackWebhookUrl } from '@/lib/integrations/slack-events';
import {
  canManageSlackDestination,
  normalizeSlackEvents,
  serializeSlackDestination,
} from '@/lib/integrations/slack-destinations';

async function loadManaged(
  companyId: string,
  id: string,
  session: Parameters<typeof canManageSlackDestination>[0]
) {
  const destination = await prisma.slackDestination.findFirst({ where: { id, companyId } });
  // Same answer for "missing" and "not yours" so ids cannot be probed
  if (!destination || !canManageSlackDestination(session, destination)) return null;
  return destination;
}

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const destination = await loadManaged(companyId, id, session);
  if (!destination) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const scope = destination.userId ? 'personal' : 'workspace';
  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim().slice(0, 80);
  }
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
  if (Array.isArray(body.events)) data.events = normalizeSlackEvents(scope, body.events);
  if (typeof body.webhookUrl === 'string' && body.webhookUrl.trim()) {
    if (!isSlackWebhookUrl(body.webhookUrl)) {
      return NextResponse.json({ error: 'Enter a Slack incoming webhook URL' }, { status: 400 });
    }
    data.webhookUrl = encryptSlackWebhookUrl(body.webhookUrl);
    data.lastError = null;
  }

  const updated = await prisma.slackDestination.update({ where: { id }, data });
  return jsonOk(serializeSlackDestination(updated));
});

/** POST = send a test message to this destination. */
export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const destination = await loadManaged(companyId, id, session);
  if (!destination) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const webhookUrl = decrypt(destination.webhookUrl);
  const error = webhookUrl
    ? await postToSlackWebhook(
        webhookUrl,
        {
          title: 'Test alert',
          text: `Sent by ${session.user.name || session.user.email || 'a teammate'} from settings. Alerts for “${destination.name}” are working.`,
        },
        null
      )
    : 'Stored webhook could not be read — save it again';

  const updated = await prisma.slackDestination.update({
    where: { id },
    data: error ? { lastError: error } : { lastError: null, lastDeliveredAt: new Date() },
  });
  if (error) {
    return NextResponse.json(
      { error, destination: serializeSlackDestination(updated) },
      { status: 503 }
    );
  }
  return jsonOk(serializeSlackDestination(updated));
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const destination = await loadManaged(companyId, id, session);
  if (!destination) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.slackDestination.delete({ where: { id } });
  return jsonOk({ ok: true });
});
