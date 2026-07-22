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

type WorkflowAction =
  | { type: 'notify'; message?: string; title?: string }
  | { type: 'log'; message?: string }
  | Record<string, unknown>;

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

  return { type, ok: true, logged: true };
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
        OR: [{ trigger: event }, { trigger: 'manual' }],
      },
    });

    // Only run workflows whose trigger exactly matches (manual only via explicit call)
    const matched = workflows.filter((w) => w.trigger === event);

    for (const workflow of matched) {
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
