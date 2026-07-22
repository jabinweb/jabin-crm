'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatSlaRemaining,
  getPrimarySlaDue,
  slaUrgencyClass,
} from '@/lib/tickets/sla-display';

type TicketSlaTimerProps = {
  ticket: {
    status?: string;
    responseDueAt?: string | Date | null;
    resolutionDueAt?: string | Date | null;
    firstResponseAt?: string | Date | null;
  };
  className?: string;
};

/** Live countdown for ticket SLA — updates every 30s. */
export function TicketSlaTimer({ ticket, className }: TicketSlaTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dueAt = getPrimarySlaDue(ticket);
  const display = formatSlaRemaining(dueAt, now);

  return (
    <span className={cn('text-xs tabular-nums', slaUrgencyClass(display.urgency), className)}>
      {display.label}
    </span>
  );
}
