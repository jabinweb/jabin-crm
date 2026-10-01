import type { Session } from 'next-auth';
import type { SlackDestination } from '@prisma/client';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { maskSlackWebhookUrl } from '@/lib/integrations/slack';
import { slackEventsForScope, type SlackScope } from '@/lib/integrations/slack-events';

export const MAX_SLACK_DESTINATIONS_PER_SCOPE = 10;

export function parseSlackScope(value: unknown): SlackScope {
  return value === 'workspace' ? 'workspace' : 'personal';
}

/** Workspace channels are admin-only; personal alerts are open to any staff member. */
export function canManageSlackScope(session: Session, scope: SlackScope): boolean {
  if (session.user.role === 'CUSTOMER') return false;
  return scope === 'personal' || hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN');
}

export function canManageSlackDestination(
  session: Session,
  destination: Pick<SlackDestination, 'userId'>
): boolean {
  if (destination.userId) return destination.userId === session.user.id;
  return canManageSlackScope(session, 'workspace');
}

/** Keep only event keys valid for the scope. A missing list (new destination) defaults to every event. */
export function normalizeSlackEvents(scope: SlackScope, raw: unknown): string[] {
  const allowed = slackEventsForScope(scope).map((e) => e.key);
  if (!Array.isArray(raw)) return allowed;
  const picked = allowed.filter((key) => raw.includes(key));
  return picked;
}

/** What the settings UI sees — never the webhook URL itself. */
export function serializeSlackDestination(destination: SlackDestination) {
  return {
    id: destination.id,
    scope: (destination.userId ? 'personal' : 'workspace') as SlackScope,
    name: destination.name,
    webhookHint: maskSlackWebhookUrl(destination.webhookUrl),
    events: destination.events,
    enabled: destination.enabled,
    lastDeliveredAt: destination.lastDeliveredAt,
    lastError: destination.lastError,
    createdAt: destination.createdAt,
  };
}

export type SlackDestinationView = ReturnType<typeof serializeSlackDestination>;
