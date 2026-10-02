/** Event catalog for Slack alerts — shared by the API and the settings UI (no server imports). */

export type SlackEventOption = { key: string; label: string; group: string };

/**
 * Workspace channel events: things that happen in the workspace, posted once per event.
 * Keys match workflow triggers where one exists.
 */
export const SLACK_WORKSPACE_EVENTS: SlackEventOption[] = [
  { key: 'lead.created', label: 'New lead', group: 'Sales' },
  { key: 'lead.updated', label: 'Lead status changed', group: 'Sales' },
  { key: 'deal.won', label: 'Deal won', group: 'Sales' },
  { key: 'ticket.created', label: 'New ticket', group: 'Support' },
  { key: 'ticket.updated', label: 'Ticket status changed', group: 'Support' },
  { key: 'project.task.created', label: 'Task created', group: 'Projects' },
  { key: 'project.task.status_changed', label: 'Task status changed', group: 'Projects' },
  { key: 'project.task.assigned', label: 'Task assigned', group: 'Projects' },
  { key: 'project.task.commented', label: 'New task comment', group: 'Projects' },
  { key: 'project.mention', label: 'Someone is @mentioned', group: 'Projects' },
  { key: 'project.updated', label: 'Project status, dates, lead or milestones changed', group: 'Projects' },
];

/**
 * Personal alert events: notifications addressed to the user (NotificationType values).
 */
export const SLACK_PERSONAL_EVENTS: SlackEventOption[] = [
  { key: 'PROJECT_TASK_ASSIGNED', label: 'A task is assigned to me', group: 'Projects' },
  { key: 'PROJECT_MENTION', label: 'I am @mentioned', group: 'Projects' },
  { key: 'PROJECT_TASK_COMMENTED', label: 'Comment on a task I follow', group: 'Projects' },
  { key: 'PROJECT_TASK_UPDATED', label: 'Status change on a task I follow', group: 'Projects' },
  { key: 'TICKET_ASSIGNED', label: 'A ticket is assigned to me', group: 'Support' },
  { key: 'TICKET_CREATED', label: 'New ticket', group: 'Support' },
  { key: 'TICKET_UPDATED', label: 'Ticket updated', group: 'Support' },
  { key: 'TICKET_RESOLVED', label: 'Ticket resolved', group: 'Support' },
  { key: 'SERVICE_REPORT_READY', label: 'Service report ready', group: 'Support' },
  { key: 'WARRANTY_EXPIRING', label: 'Warranty expiring', group: 'Support' },
];

export type SlackScope = 'workspace' | 'personal';

export function slackEventsForScope(scope: SlackScope): SlackEventOption[] {
  return scope === 'workspace' ? SLACK_WORKSPACE_EVENTS : SLACK_PERSONAL_EVENTS;
}

/** Only real Slack webhook endpoints — also keeps the server from being pointed at arbitrary hosts. */
export function isSlackWebhookUrl(value: string): boolean {
  return /^https:\/\/hooks\.slack(-gov)?\.com\/(services|triggers|workflows)\/[A-Za-z0-9/_-]+$/.test(
    value.trim()
  );
}
