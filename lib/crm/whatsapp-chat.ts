/** Normalize WhatsApp chat id for filter matching (DM or group). */
export function normalizeWhatsAppChatJid(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/^whatsapp:/i, '');
}

export function isWhatsAppGroupJid(jid: string): boolean {
  return normalizeWhatsAppChatJid(jid).endsWith('@g.us');
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

/** Prefer human name; never show raw group id as the speaker. */
export function resolveWhatsAppSenderName(opts: {
  fromMe?: boolean;
  chatJid: string;
  sender?: unknown;
  pushName?: unknown;
  participant?: unknown;
  senderName?: unknown;
}): string | null {
  if (opts.fromMe) return 'You';
  const push = String(opts.pushName || opts.senderName || '').trim();
  if (push && push.toLowerCase() !== 'me') return push;

  const sender = String(opts.sender || '').trim();
  const groupLocal = opts.chatJid.replace(/@g\.us$/i, '');
  if (
    sender &&
    sender.toLowerCase() !== 'me' &&
    sender !== groupLocal &&
    !sender.endsWith('@g.us')
  ) {
    return sender;
  }

  const participant = String(opts.participant || '')
    .trim()
    .replace(/@.*$/, '');
  if (participant && participant !== groupLocal) return participant;

  return null;
}

export function messageMatchesInboxFilter(
  chatJid: string,
  filterType: string,
  allowedJids: string[]
): boolean {
  const jid = normalizeWhatsAppChatJid(chatJid);
  if (!jid || jid === 'status@broadcast') return false;
  const type = String(filterType || 'ALL').toUpperCase();
  if (type === 'ALL') return true;
  if (type === 'GROUPS_ONLY') return isWhatsAppGroupJid(jid);
  if (type === 'CUSTOM') {
    const raw = jid.split('@')[0];
    return (
      allowedJids.includes(jid) ||
      allowedJids.includes(raw) ||
      allowedJids.some((a) => normalizeWhatsAppChatJid(a) === jid)
    );
  }
  return true;
}
