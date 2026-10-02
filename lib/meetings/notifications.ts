/**
 * Team meeting notifications: in-app (+ realtime + personal Slack via notificationService)
 * for every change, plus email for the ones people act on outside the app
 * (invite, reschedule, cancellation, reminder) when platform SMTP is configured.
 * Never throws — callers fire and forget after responding.
 */
import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';
import { getAppBaseUrl } from '@/lib/app-url';
import { getCompanyUrl } from '@/lib/company-url';
import { logError } from '@/lib/logger';
import { publishRealtimeTo } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import {
  isPlatformEmailConfigured,
  sendActionEmail,
  type ActionEmailContent,
} from '@/lib/email/action-email';

export function meetingHref(meetingId: string) {
  return `/dashboard/meetings/${meetingId}`;
}

/** Company-level switch: Settings → Notifications → "Enable Email Notifications". */
function emailEnabledInSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object') return true;
  const notifications = (settings as Record<string, unknown>).notifications;
  if (!notifications || typeof notifications !== 'object') return true;
  const email = (notifications as Record<string, unknown>).email;
  if (!email || typeof email !== 'object') return true;
  return (email as Record<string, unknown>).enabled !== false;
}

/** Zone for times written into notifications/emails when the actor's browser zone is unknown. */
export const DEFAULT_MEETING_TIME_ZONE =
  process.env.MEETINGS_TIMEZONE || process.env.HR_TIMEZONE || 'Asia/Kolkata';

function safeZone(timeZone?: string | null) {
  if (!timeZone) return DEFAULT_MEETING_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_MEETING_TIME_ZONE;
  }
}

/** "Tue 7 Oct, 3:00 PM – 3:30 PM GMT+5:30" in the given (or default) time zone. */
export function formatMeetingTime(
  start: Date | string,
  end?: Date | string | null,
  timeZone?: string | null
) {
  const zone = safeZone(timeZone);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(start));
  const time = (d: Date | string, withZone: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
      ...(withZone ? { timeZoneName: 'short' as const } : {}),
    }).format(new Date(d));
  if (!end) return `${day}, ${time(start, true)}`;
  return `${day}, ${time(start, false)} – ${time(end, true)}`;
}

type MeetingRef = {
  id: string;
  companyId: string;
  title: string;
};

/** Tell open clients (calendar, meetings list, header indicator) to refetch. */
export async function publishMeetingChanged(meeting: Pick<MeetingRef, 'id' | 'companyId'>, userIds: string[], actorId?: string) {
  try {
    await publishRealtimeTo(
      REALTIME_EVENTS.MEETING_UPDATED,
      meeting.companyId,
      Array.from(new Set(userIds.filter(Boolean))),
      { meetingId: meeting.id },
      actorId
    );
  } catch (error) {
    logError(error, { context: 'meeting realtime publish failed' });
  }
}

export async function deliverMeetingNotification(params: {
  type: NotificationType;
  meeting: MeetingRef;
  userIds: string[];
  title: string;
  body: string;
  /** Inline actions in the notifications panel (Accept / Decline / Maybe, Join). */
  actions?: Array<'rsvp' | 'join'>;
  email?: ActionEmailContent;
}) {
  const userIds = Array.from(new Set(params.userIds.filter(Boolean)));
  if (userIds.length === 0) return;
  const href = meetingHref(params.meeting.id);

  try {
    await Promise.all(
      userIds.map((userId) =>
        notificationService.create({
          type: params.type,
          userId,
          title: params.title,
          body: params.body,
          metadata: {
            companyId: params.meeting.companyId,
            meetingId: params.meeting.id,
            href,
            actions: params.actions ?? [],
          },
        })
      )
    );
  } catch (error) {
    logError(error, { context: 'meeting notification: in-app delivery failed' });
  }

  if (!params.email || !isPlatformEmailConfigured()) return;

  try {
    const [company, users] = await Promise.all([
      prisma.company.findUnique({
        where: { id: params.meeting.companyId },
        select: { slug: true, name: true, settings: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds }, userStatus: 'ACTIVE' },
        select: { email: true, name: true },
      }),
    ]);
    if (!company?.slug || !emailEnabledInSettings(company.settings)) return;
    const url = `${getAppBaseUrl().replace(/\/$/, '')}${getCompanyUrl(href, company.slug)}`;
    const content = params.email;
    const results = await Promise.allSettled(
      users
        .filter((u: { email: string | null }) => !!u.email)
        .map((u: { email: string; name: string | null }) =>
          sendActionEmail({
            to: u.email,
            recipientName: u.name,
            contextLabel: company.name,
            url,
            content,
            footer: 'You are receiving this because you were invited to this meeting.',
          })
        )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        logError(result.reason, { context: 'meeting notification: email failed' });
      }
    }
  } catch (error) {
    logError(error, { context: 'meeting notification: email delivery failed' });
  }
}
