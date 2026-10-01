import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { encryptSlackWebhookUrl, postToSlackWebhook } from '@/lib/integrations/slack';
import { isSlackWebhookUrl } from '@/lib/integrations/slack-events';
import {
  MAX_SLACK_DESTINATIONS_PER_SCOPE,
  canManageSlackScope,
  normalizeSlackEvents,
  parseSlackScope,
  serializeSlackDestination,
} from '@/lib/integrations/slack-destinations';

/** GET /api/integrations/slack?scope=workspace|personal */
export const GET = withTenantRoute(async (request, { session, companyId }) => {
  const scope = parseSlackScope(new URL(request.url).searchParams.get('scope'));
  if (!canManageSlackScope(session, scope)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const destinations = await prisma.slackDestination.findMany({
    where: { companyId, userId: scope === 'workspace' ? null : session.user.id },
    orderBy: { createdAt: 'asc' },
  });
  return jsonOk({ destinations: destinations.map(serializeSlackDestination) });
});

/** Connect a Slack incoming webhook. Sends a confirmation message so a bad URL fails here, not later. */
export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const body = await request.json().catch(() => ({}));
  const scope = parseSlackScope(body.scope);
  if (!canManageSlackScope(session, scope)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  if (!isSlackWebhookUrl(webhookUrl)) {
    return NextResponse.json(
      { error: 'Enter a Slack incoming webhook URL (https://hooks.slack.com/services/…)' },
      { status: 400 }
    );
  }
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 80)
      : scope === 'workspace'
        ? 'Slack channel'
        : 'My Slack alerts';

  const userId = scope === 'workspace' ? null : session.user.id;
  const existing = await prisma.slackDestination.count({ where: { companyId, userId } });
  if (existing >= MAX_SLACK_DESTINATIONS_PER_SCOPE) {
    return NextResponse.json(
      { error: `You can connect up to ${MAX_SLACK_DESTINATIONS_PER_SCOPE} Slack destinations` },
      { status: 400 }
    );
  }

  const error = await postToSlackWebhook(
    webhookUrl,
    {
      title: 'Slack alerts connected',
      text:
        scope === 'workspace'
          ? `${session.user.name || session.user.email || 'An admin'} connected this channel. Selected workspace events will be posted here.`
          : 'Your notifications will be sent here.',
    },
    null
  );
  if (error) {
    return NextResponse.json(
      { error: `Slack rejected the test message — ${error}` },
      { status: 400 }
    );
  }

  const destination = await prisma.slackDestination.create({
    data: {
      companyId,
      userId,
      name,
      webhookUrl: encryptSlackWebhookUrl(webhookUrl),
      events: normalizeSlackEvents(scope, body.events),
      lastDeliveredAt: new Date(),
    },
  });
  return jsonOk(serializeSlackDestination(destination), { status: 201 });
});
