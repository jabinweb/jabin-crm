export type SlaUrgency = 'ok' | 'soon' | 'critical' | 'breached' | 'none';

export type SlaDisplay = {
  label: string;
  urgency: SlaUrgency;
  dueAt: Date | null;
};

/** Pick the soonest relevant SLA deadline for an open ticket. */
export function getPrimarySlaDue(ticket: {
  status?: string;
  responseDueAt?: string | Date | null;
  resolutionDueAt?: string | Date | null;
  firstResponseAt?: string | Date | null;
}): Date | null {
  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  if (closed) return null;

  const responseDue = ticket.responseDueAt ? new Date(ticket.responseDueAt) : null;
  const resolutionDue = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt) : null;
  const hasResponded = Boolean(ticket.firstResponseAt);

  if (!hasResponded && responseDue) return responseDue;
  return resolutionDue ?? responseDue;
}

export function formatSlaRemaining(dueAt: Date | null, now = new Date()): SlaDisplay {
  if (!dueAt || Number.isNaN(dueAt.getTime())) {
    return { label: '—', urgency: 'none', dueAt: null };
  }

  const ms = dueAt.getTime() - now.getTime();
  const absMs = Math.abs(ms);
  const mins = Math.floor(absMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let amount: string;
  if (days >= 1) amount = `${days}d ${hours % 24}h`;
  else if (hours >= 1) amount = `${hours}h ${mins % 60}m`;
  else amount = `${Math.max(mins, 1)}m`;

  if (ms < 0) {
    return { label: `Overdue ${amount}`, urgency: 'breached', dueAt };
  }
  if (ms < 2 * 60 * 60 * 1000) {
    return { label: `${amount} left`, urgency: 'critical', dueAt };
  }
  if (ms < 8 * 60 * 60 * 1000) {
    return { label: `${amount} left`, urgency: 'soon', dueAt };
  }
  return { label: `${amount} left`, urgency: 'ok', dueAt };
}

export function slaUrgencyClass(urgency: SlaUrgency): string {
  switch (urgency) {
    case 'breached':
      return 'text-destructive font-semibold';
    case 'critical':
      return 'text-orange-600 font-semibold';
    case 'soon':
      return 'text-amber-600 font-medium';
    case 'ok':
      return 'text-emerald-700';
    default:
      return 'text-muted-foreground';
  }
}
