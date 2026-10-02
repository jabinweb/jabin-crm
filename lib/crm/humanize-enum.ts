/**
 * Turn a raw enum value (e.g. `IN_PROGRESS`, `follow_up`, `PARTIALLY_PAID`)
 * into user-facing copy ("In progress", "Follow up", "Partially paid").
 * Returns the fallback for empty values.
 */
export function humanizeEnum(value: string | null | undefined, fallback = '—'): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const words = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
