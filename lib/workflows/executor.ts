import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';
import { NotificationType } from '@prisma/client';

export type WorkflowEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'ticket.created'
  | 'ticket.updated'
  | 'deal.won'
  | 'project.task.created'
  | 'project.task.status_changed'
  | 'manual';

export type WorkflowAction =
  | { type: 'notify'; message?: string; title?: string }
  | { type: 'log'; message?: string }
  | {
      type: 'assign';
      assigneeId?: string;
      assigneeMode?: 'fixed' | 'round_robin';
    }
  | {
      type: 'create_task';
      title?: string;
      message?: string;
      dueInDays?: number;
      assigneeId?: string;
    }
  | {
      type: 'create_project_task';
      projectId?: string;
      title?: string;
      message?: string;
      dueInDays?: number;
      assigneeId?: string;
    }
  | {
      type: 'send_email';
      to?: string;
      subject?: string;
      message?: string;
      body?: string;
    }
  | {
      type: 'send_whatsapp';
      toPhone?: string;
      message?: string;
      channel?: string;
    }
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
  projectId?: string;
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

function substitute(
  template: string,
  payload: WorkflowEventPayload,
  extras: Record<string, string> = {}
) {
  const bag: Record<string, string> = {
    title: payload.title || '',
    summary: payload.summary || '',
    leadId: payload.leadId || '',
    ticketId: payload.ticketId || '',
    dealId: payload.dealId || '',
    event: '',
    ...extras,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => bag[key] ?? '');
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

  if (type === 'assign') {
    const cfg = action as {
      assigneeId?: string;
      assigneeMode?: 'fixed' | 'round_robin';
    };
    let assigneeId = cfg.assigneeId?.trim() || '';

    if (cfg.assigneeMode === 'round_robin' || !assigneeId) {
      const { getNextAvailableAgent } = await import('@/lib/support/ticket-assignment');
      const agent = await getNextAvailableAgent({
        companyId: payload.companyId,
        groupId:
          typeof payload.metadata?.groupId === 'string'
            ? payload.metadata.groupId
            : undefined,
      });
      assigneeId = agent?.id || '';
    }

    if (!assigneeId) {
      return { type, ok: false, error: 'No assignee available' };
    }

    if (payload.ticketId) {
      const { ticketService } = await import('@/lib/crm/ticket-service');
      await ticketService.transferTicket(
        payload.ticketId,
        assigneeId,
        'Assigned by workflow',
        payload.userId
      );
      return { type, ok: true, assigneeId, target: 'ticket' };
    }

    if (payload.leadId) {
      await prisma.lead.update({
        where: { id: payload.leadId },
        data: { assignedToId: assigneeId },
      });
      return { type, ok: true, assigneeId, target: 'lead' };
    }

    return { type, ok: false, error: 'No ticketId or leadId in payload' };
  }

  if (type === 'create_task') {
    const cfg = action as {
      title?: string;
      message?: string;
      dueInDays?: number;
      assigneeId?: string;
    };
    const { taskService } = await import('@/lib/tasks/task-service');
    const ownerId = cfg.assigneeId?.trim() || payload.userId;
    const dueInDays = Number(cfg.dueInDays);
    const dueDate =
      Number.isFinite(dueInDays) && dueInDays > 0
        ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)
        : undefined;

    const task = await taskService.createTask(ownerId, {
      title:
        substitute(cfg.title || payload.title || `Follow up (${event})`, payload) ||
        `Follow up (${event})`,
      description: cfg.message || payload.summary,
      leadId: payload.leadId,
      dealId: payload.dealId,
      dueDate,
      type: 'FOLLOW_UP',
    });
    return { type, ok: true, taskId: task.id };
  }

  if (type === 'create_project_task') {
    const cfg = action as {
      projectId?: string;
      title?: string;
      message?: string;
      dueInDays?: number;
      assigneeId?: string;
    };
    const projectId =
      cfg.projectId?.trim() ||
      payload.projectId?.trim() ||
      (typeof payload.metadata?.projectId === 'string'
        ? payload.metadata.projectId.trim()
        : '');
    if (!projectId) {
      return { type, ok: false, error: 'No projectId in action config or payload' };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(payload.companyId ? { companyId: payload.companyId } : {}),
      },
      select: { id: true },
    });
    if (!project) {
      return { type, ok: false, error: 'Project not found' };
    }

    const dueInDays = Number(cfg.dueInDays);
    const dueDate =
      Number.isFinite(dueInDays) && dueInDays > 0
        ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)
        : undefined;

    const task = await prisma.projectTask.create({
      data: {
        projectId: project.id,
        title:
          substitute(cfg.title || payload.title || `Project task (${event})`, payload) ||
          `Project task (${event})`,
        description: cfg.message || payload.summary || null,
        assigneeId: cfg.assigneeId?.trim() || null,
        reporterId: payload.userId,
        dueDate: dueDate ?? null,
        status: 'TODO',
        priority: 'MEDIUM',
      },
    });
    return { type, ok: true, taskId: task.id, projectId: project.id };
  }

  if (type === 'send_email') {
    const cfg = action as {
      to?: string;
      subject?: string;
      message?: string;
      body?: string;
    };
    let to = cfg.to?.trim() || '';
    const extras: Record<string, string> = {};

    if (!to && payload.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
        select: { email: true, contactName: true, companyName: true },
      });
      to = lead?.email || '';
      extras.contactName = lead?.contactName || '';
      extras.companyName = lead?.companyName || '';
    }
    if (!to && payload.ticketId) {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: payload.ticketId },
        include: { customer: { select: { email: true, contactPerson: true, organizationName: true } } },
      });
      to = ticket?.customer.email || '';
      extras.contactName = ticket?.customer.contactPerson || '';
      extras.companyName = ticket?.customer.organizationName || '';
    }

    if (!to) {
      return { type, ok: false, error: 'No email recipient resolved' };
    }

    const { sendEmail } = await import('@/lib/email/nodemailer');
    const subject = substitute(
      cfg.subject || payload.title || `Update: ${event}`,
      payload,
      extras
    );
    const html = substitute(
      cfg.body || cfg.message || payload.summary || `Event ${event} fired`,
      payload,
      extras
    );
    await sendEmail({ to, subject, html });
    return { type, ok: true, to };
  }

  if (type === 'send_whatsapp') {
    const cfg = action as {
      toPhone?: string;
      message?: string;
      channel?: string;
    };
    let toPhone = cfg.toPhone?.trim() || '';
    let customerId: string | undefined;

    if (!toPhone && payload.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
        select: { phone: true },
      });
      toPhone = lead?.phone || '';
    }
    if (!toPhone && payload.ticketId) {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: payload.ticketId },
        include: { customer: { select: { id: true, phone: true } } },
      });
      toPhone = ticket?.customer.phone || '';
      customerId = ticket?.customer.id;
    }

    if (!toPhone) {
      return { type, ok: false, error: 'No WhatsApp phone resolved' };
    }

    try {
      const { whatsAppService } = await import('@/lib/crm/whatsapp-service');
      const channel = 'SERVICE' as const;
      await whatsAppService.sendMessage({
        userId: payload.userId,
        toPhone,
        message: substitute(
          cfg.message || payload.summary || payload.title || `Update: ${event}`,
          payload
        ),
        channel,
        leadId: payload.leadId,
        ticketId: payload.ticketId,
        customerId,
      });
      return { type, ok: true, toPhone };
    } catch (err) {
      return {
        type,
        ok: false,
        error: err instanceof Error ? err.message : 'WhatsApp send failed',
      };
    }
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
          const result = await runAction(action, event, payload);
          results.push(result);
          if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
            status = 'PARTIAL';
          }
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
