import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { getAppBaseUrl } from '@/lib/app-url';
import { getBrandConfig } from '@/lib/branding';
import { getCompanyUrl } from '@/lib/company-url';
import { logError } from '@/lib/logger';
import { isSlackWebhookUrl } from '@/lib/integrations/slack-events';

const SLACK_TIMEOUT_MS = 5000;

export function encryptSlackWebhookUrl(url: string): string {
  return JSON.stringify(encrypt(url.trim()));
}

function decryptSlackWebhookUrl(stored: string): string | null {
  const url = decrypt(stored);
  return url && isSlackWebhookUrl(url) ? url : null;
}

/** Enough of the URL to recognise it in settings, without exposing the secret part. */
export function maskSlackWebhookUrl(stored: string): string {
  const url = decryptSlackWebhookUrl(stored);
  if (!url) return 'Invalid webhook';
  return `hooks.slack.com/…${url.slice(-6)}`;
}

/** Slack mrkdwn treats &, < and > as control characters. */
function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type SlackAlert = {
  title: string;
  text?: string | null;
  /** Logical dashboard path, e.g. /dashboard/tickets/abc — resolved to the tenant URL */
  href?: string | null;
  /** Small grey line under the message, e.g. the project name */
  context?: string | null;
};

function buildPayload(alert: SlackAlert, url: string | null) {
  const brand = getBrandConfig();
  const body = `*${esc(alert.title)}*${alert.text ? `\n${esc(alert.text)}` : ''}`;
  const blocks: unknown[] = [{ type: 'section', text: { type: 'mrkdwn', text: body } }];
  if (alert.context) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: esc(alert.context) }],
    });
  }
  if (url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `Open in ${brand.appName}` },
          url,
        },
      ],
    });
  }
  return {
    // Fallback for notifications / clients that do not render blocks
    text: `${alert.title}${alert.text ? ` — ${alert.text}` : ''}`,
    blocks,
  };
}

/** POST one message to a Slack incoming webhook. Returns an error string, or null on success. */
export async function postToSlackWebhook(
  webhookUrl: string,
  alert: SlackAlert,
  url: string | null
): Promise<string | null> {
  if (!isSlackWebhookUrl(webhookUrl)) return 'Not a Slack webhook URL';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(alert, url)),
      signal: controller.signal,
      redirect: 'error',
    });
    if (res.ok) return null;
    const detail = (await res.text().catch(() => '')).slice(0, 120);
    return `Slack responded ${res.status}${detail ? `: ${detail}` : ''}`;
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError'
      ? 'Slack did not respond in time'
      : 'Could not reach Slack';
  } finally {
    clearTimeout(timer);
  }
}

async function absoluteUrl(companyId: string, href?: string | null) {
  if (!href) return null;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  if (!company?.slug) return null;
  return `${getAppBaseUrl().replace(/\/$/, '')}${getCompanyUrl(href, company.slug)}`;
}

type Destination = { id: string; webhookUrl: string };

async function deliver(companyId: string, destinations: Destination[], alert: SlackAlert) {
  if (destinations.length === 0) return;
  const url = await absoluteUrl(companyId, alert.href);
  await Promise.all(
    destinations.map(async (destination) => {
      const webhookUrl = decryptSlackWebhookUrl(destination.webhookUrl);
      const error = webhookUrl
        ? await postToSlackWebhook(webhookUrl, alert, url)
        : 'Stored webhook could not be read — save it again';
      await prisma.slackDestination
        .update({
          where: { id: destination.id },
          data: error
            ? { lastError: error }
            : { lastError: null, lastDeliveredAt: new Date() },
        })
        .catch(() => undefined);
    })
  );
}

/**
 * Post a workspace event to every workspace channel subscribed to it.
 * Call once per event (not once per recipient). Never throws.
 */
export async function sendWorkspaceSlackEvent(
  companyId: string | null | undefined,
  event: string,
  alert: SlackAlert
) {
  if (!companyId) return;
  try {
    const destinations = await prisma.slackDestination.findMany({
      where: { companyId, userId: null, enabled: true, events: { has: event } },
      select: { id: true, webhookUrl: true },
    });
    await deliver(companyId, destinations, alert);
  } catch (error) {
    logError(error, { context: 'slack: workspace event failed', event });
  }
}

/**
 * Mirror one of the user's in-app notifications to their personal Slack alerts.
 * Never throws.
 */
export async function sendPersonalSlackAlert(
  companyId: string | null | undefined,
  userId: string,
  notificationType: string,
  alert: SlackAlert
) {
  if (!companyId) return;
  try {
    const destinations = await prisma.slackDestination.findMany({
      where: { companyId, userId, enabled: true, events: { has: notificationType } },
      select: { id: true, webhookUrl: true },
    });
    await deliver(companyId, destinations, alert);
  } catch (error) {
    logError(error, { context: 'slack: personal alert failed', notificationType });
  }
}
