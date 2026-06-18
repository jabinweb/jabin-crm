import type { TicketPriority, TicketStatus } from '@prisma/client';

export type AutomationTrigger =
  | 'TICKET_CREATED'
  | 'TICKET_STATUS_CHANGED'
  | 'SLA_AT_RISK'
  | 'SLA_BREACHED';

export type AutomationAction =
  | { type: 'SET_PRIORITY'; priority: TicketPriority }
  | { type: 'ADD_TAG'; tag: string }
  | { type: 'ASSIGN_GROUP'; groupName: string }
  | { type: 'NOTIFY'; title: string; body: string };

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions?: {
    channel?: string;
    ticketType?: string;
    priority?: TicketPriority;
    status?: TicketStatus;
  };
  actions: AutomationAction[];
}

export interface SupportAutomationSettings {
  rules?: AutomationRule[];
}

export function parseAutomationRules(raw: unknown): AutomationRule[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const obj = raw as SupportAutomationSettings;
  return Array.isArray(obj.rules) ? obj.rules : [];
}

export function ruleMatches(
  rule: AutomationRule,
  event: {
    trigger: AutomationTrigger;
    channel?: string;
    ticketType?: string | null;
    priority?: TicketPriority;
    status?: TicketStatus;
  }
): boolean {
  if (!rule.enabled || rule.trigger !== event.trigger) return false;
  const c = rule.conditions;
  if (!c) return true;
  if (c.channel && c.channel !== event.channel) return false;
  if (c.ticketType && c.ticketType !== event.ticketType) return false;
  if (c.priority && c.priority !== event.priority) return false;
  if (c.status && c.status !== event.status) return false;
  return true;
}

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'auto_tag_portal',
    name: 'Tag portal requests',
    enabled: true,
    trigger: 'TICKET_CREATED',
    conditions: { channel: 'PORTAL' },
    actions: [{ type: 'ADD_TAG', tag: 'portal' }],
  },
  {
    id: 'escalate_critical',
    name: 'Flag critical tickets',
    enabled: true,
    trigger: 'TICKET_CREATED',
    conditions: { priority: 'CRITICAL' },
    actions: [
      { type: 'ADD_TAG', tag: 'urgent' },
      {
        type: 'NOTIFY',
        title: 'Critical ticket opened',
        body: 'A critical priority ticket requires immediate attention.',
      },
    ],
  },
  {
    id: 'sla_at_risk_notify',
    name: 'SLA at-risk alert',
    enabled: true,
    trigger: 'SLA_AT_RISK',
    actions: [
      {
        type: 'NOTIFY',
        title: 'SLA at risk',
        body: 'A ticket is approaching its SLA deadline.',
      },
    ],
  },
  {
    id: 'sla_breached_escalate',
    name: 'SLA breach escalation',
    enabled: true,
    trigger: 'SLA_BREACHED',
    actions: [
      { type: 'ADD_TAG', tag: 'sla-breached' },
      {
        type: 'NOTIFY',
        title: 'SLA breached',
        body: 'A ticket has breached its SLA and requires immediate attention.',
      },
    ],
  },
];
