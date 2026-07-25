/** Normalize WhatsApp chat id for filter matching (DM or group). */
export function normalizeWhatsAppChatJid(raw: string | null | undefined): string {
  return String(raw || '').trim();
}

export function isWhatsAppGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/** Extract chat JID from a stored WhatsAppMessage row. */
export function extractWhatsAppChatJid(message: {
  fromPhone?: string | null;
  toPhone?: string | null;
  metadata?: unknown;
}): string {
  const meta = (message.metadata || {}) as Record<string, unknown>;
  const data = (meta.data || {}) as Record<string, unknown>;
  return normalizeWhatsAppChatJid(
    (typeof data.remoteJid === 'string' && data.remoteJid) ||
      (typeof meta.remoteJid === 'string' && meta.remoteJid) ||
      message.fromPhone ||
      message.toPhone ||
      ''
  );
}

export function messageMatchesInboxFilter(
  chatJid: string,
  filterType: string,
  allowedJids: string[]
): boolean {
  if (!chatJid || chatJid === 'status@broadcast') return false;
  const type = String(filterType || 'ALL').toUpperCase();
  if (type === 'ALL') return true;
  if (type === 'GROUPS_ONLY') return isWhatsAppGroupJid(chatJid);
  if (type === 'CUSTOM') {
    const raw = chatJid.split('@')[0];
    return allowedJids.includes(chatJid) || allowedJids.includes(raw);
  }
  return true;
}
