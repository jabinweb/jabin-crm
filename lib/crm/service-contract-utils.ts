/** Pure helpers for AMC/CMC renewal display (safe for client + server). */

export function daysUntil(date: Date, from = new Date()): number {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function renewalUrgency(
  daysLeft: number
): 'overdue' | 'critical' | 'soon' | 'ok' {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 14) return 'critical';
  if (daysLeft <= 45) return 'soon';
  return 'ok';
}

/** Statuses that consume a contract visit. */
export const VISIT_COUNTING_STATUSES = ['RESOLVED', 'CLOSED'] as const;

export type VisitUsage = {
  visitLimit: number | null;
  visitsUsed: number;
  remaining: number | null;
  overLimit: boolean;
};

export function computeVisitUsage(
  visitLimit: number | null | undefined,
  visitsUsed: number
): VisitUsage {
  const limit = visitLimit ?? null;
  const remaining = limit == null ? null : Math.max(0, limit - visitsUsed);
  return {
    visitLimit: limit,
    visitsUsed,
    remaining,
    overLimit: limit != null && visitsUsed >= limit,
  };
}
