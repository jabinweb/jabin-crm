/**
 * Turn a raw enum value (`IN_PROGRESS`, `EMAIL_SENT`, `SUPER_ADMIN`) into sentence case
 * for display ("In progress", "Email sent", "Super admin"). Never show raw enums to users.
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '';
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
