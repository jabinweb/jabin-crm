/**
 * Turn an enum-style value (`IN_PROGRESS`, `whatsapp`, `FOLLOW_UP`) into
 * user-facing sentence case ("In progress", "Whatsapp", "Follow up").
 * Pass `overrides` for words that need special casing (e.g. { WHATSAPP: 'WhatsApp' }).
 */
export function humanizeEnum(
  value: string | null | undefined,
  overrides?: Record<string, string>
): string {
  if (!value) return '';
  if (overrides?.[value]) return overrides[value];
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Common channel / acronym spellings shared by support and ops screens. */
export const ENUM_LABEL_OVERRIDES: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  whatsapp: 'WhatsApp',
  SMS: 'SMS',
  API: 'API',
  CSAT: 'CSAT',
  SLA: 'SLA',
  GPS: 'GPS',
};
