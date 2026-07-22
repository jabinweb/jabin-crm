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
