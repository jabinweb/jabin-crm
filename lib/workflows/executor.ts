import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';
import { NotificationType } from '@prisma/client';

export type WorkflowEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'ticket.created'
  | 'ticket.updated'
  | 'deal.won'
  | 'manual';

export type WorkflowAction =
  | { type: 'notify'; message?: string; title?: string }
  | { type: 'log'; message?: string }
  | Record<string, unknown>;

/** Simple equality filters against event metadata / payload. Empty values are ignored. */
export type WorkflowConditions = {
  status?: string;
  priority?: string;
  channel?: string;
  source?: string;
  /** Lead status after update */
  newStatus?: string;
};

export type WorkflowEventPayload = {
  userId: string;
  companyId?: string | null;
  leadId?: string;
  ticketId?: string;
  dealId?: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

function asActions(raw: unknown): WorkflowAction[] {
  if (Array.isArray(raw)) return raw as WorkflowAction[];
  if (raw && typeof raw === 'object') return [raw as WorkflowAction];
  return [];
}

export function parseConditions(raw: unknown): WorkflowConditions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const c = raw as Record<string, unknown>;
  const out: WorkflowConditions = {};
  for (const key of ['status', 'priority', 'channel', 'source', 'newStatus'] as const) {
    if (typeof c[key] === 'string' && c[key].trim()) {
      out[key] = c[key].trim();
    }
  }
  return out;
}

export function matchesWorkflowConditions(
  conditions: unknown,
  payload: WorkflowEventPayload
): boolean {
  const c = parseConditions(conditions);
  const keys = Object.keys(c) as (keyof WorkflowConditions)[];
  if (keys.length === 0) return true;

  const meta = payload.metadata || {};
  const status =
    (typeof meta.status === 'string' && meta.status) ||
    (typeof meta.newStatus === 'string' && meta.newStatus) ||
    undefined;
  const priority = typeof meta.priority === 'string' ? meta.priority : undefined;
  const channel = typeof meta.channel === 'string' ? meta.channel : undefined;
  const source = typeof meta.source === 'string' ? meta.source : undefined;
  const newStatus = typeof meta.newStatus === 'string' ? meta.newStatus : status;

  if (c.status && c.status !== status) return false;
  if (c.newStatus && c.newStatus !== newStatus) return false;
  if (c.priority && c.priority !== priority) return false;
  if (c.channel && c.channel !== channel) return false;
  if (c.source && c.source !== source) return false;
  return true;
}

async function runAction(
  action: WorkflowAction,
  event: WorkflowEvent,
  payload: WorkflowEventPayload
) {
  const type = String((action as { type?: string }).type || 'log');

  if (type === 'notify') {
    const title =
      (action as { title?: string }).title ||
      payload.title ||
      `Workflow: ${event}`;
    const body =
      (action as { message?: string }).message ||
      payload.summary ||
      `Event ${event} fired`;
    await notificationService.create({
      type: NotificationType.TICKET_UPDATED,
      title,
      body,
      userId: payload.userId,
      metadata: {
        event,
        leadId: payload.leadId,
        ticketId: payload.ticketId,
        ...(payload.metadata || {}),
      },
    });
    return { type, ok: true };
  }

  return {
    type,
    ok: true,
    logged: true,
    message: (action as { message?: string }).message || payload.summary || event,
  };
}

/**
 * Run all active workflows for a trigger key owned by the user.
 * Failures are recorded per execution and never throw to callers.
 */
export async function dispatchWorkflowEvent(
  event: WorkflowEvent,
  payload: WorkflowEventPayload
) {
  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        userId: payload.userId,
        isActive: true,
        trigger: event,
      },
    });

    for (const workflow of workflows) {
      if (!matchesWorkflowConditions(workflow.conditions, payload)) {
        continue;
      }

      const actions = asActions(workflow.actions);
      const results: unknown[] = [];
      let status = 'SUCCESS';

      try {
        for (const action of actions) {
          results.push(await runAction(action, event, payload));
        }
        if (actions.length === 0) {
          results.push({ type: 'noop', ok: true });
        }
      } catch (err) {
        status = 'FAILED';
        results.push({
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      await prisma.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          leadId: payload.leadId ?? null,
          status,
          result: { event, results, payload: payload.metadata ?? {} },
        },
      });
    }
  } catch (err) {
    console.error('[workflows] dispatch failed', event, err);
  }
}
