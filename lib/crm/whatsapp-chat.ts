/** Normalize WhatsApp chat id for filter matching (DM or group). */
export function normalizeWhatsAppChatJid(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/^whatsapp:/i, '');
}

export function isWhatsAppGroupJid(jid: string): boolean {
  return normalizeWhatsAppChatJid(jid).endsWith('@g.us');
}

/** Local part of a JID; strips device suffix (`123:0@s.whatsapp.net` → `123`). */
export function jidLocalPart(jid: string | null | undefined): string {
  return String(jid || '')
    .trim()
    .split('@')[0]
    .split(':')[0]
    .trim();
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

function pickMetaField(
  meta: Record<string, unknown>,
  data: Record<string, unknown>,
  key: string
): unknown {
  if (data[key] != null && data[key] !== '') return data[key];
  if (meta[key] != null && meta[key] !== '') return meta[key];
  return null;
}

/** Pull sender fields from nested Summora webhook metadata. */
export function extractWhatsAppSenderFields(metadata: unknown): {
  pushName: string | null;
  participant: string | null;
  participantAlt: string | null;
  sender: string | null;
  senderPhone: string | null;
  senderLid: string | null;
  contactName: string | null;
  fromMe: boolean;
} {
  const meta = (metadata || {}) as Record<string, unknown>;
  const data = (meta.data || {}) as Record<string, unknown>;
  const rawKey = (data.rawKey || meta.rawKey || {}) as Record<string, unknown>;

  const participant =
    (pickMetaField(meta, data, 'participant') as string | null) ||
    (typeof rawKey.participant === 'string' ? rawKey.participant : null);
  const participantAlt =
    (pickMetaField(meta, data, 'participantAlt') as string | null) ||
    (typeof rawKey.participantAlt === 'string' ? rawKey.participantAlt : null);
  const pushName = (pickMetaField(meta, data, 'pushName') as string | null) || null;
  const sender = (pickMetaField(meta, data, 'sender') as string | null) || null;
  const senderPhone =
    (pickMetaField(meta, data, 'senderPhone') as string | null) || null;
  const senderLid =
    (pickMetaField(meta, data, 'senderLid') as string | null) || null;
  const contactName =
    (pickMetaField(meta, data, 'contactName') as string | null) || null;
  const fromMe =
    meta.fromMe === true ||
    data.fromMe === true ||
    rawKey.fromMe === true;

  return {
    pushName: pushName ? String(pushName).trim() : null,
    participant: participant ? String(participant) : null,
    participantAlt: participantAlt ? String(participantAlt) : null,
    sender: sender ? String(sender).trim() : null,
    senderPhone: senderPhone ? String(senderPhone).trim() : null,
    senderLid: senderLid ? String(senderLid).trim() : null,
    contactName: contactName ? String(contactName).trim() : null,
    fromMe,
  };
}

function looksLikeGroupId(value: string, chatJid: string): boolean {
  const groupLocal = jidLocalPart(chatJid);
  const local = jidLocalPart(value);
  if (!local) return false;
  if (value.endsWith('@g.us') || local === groupLocal) return true;
  // WhatsApp group ids are long numeric (typically 15–20 digits)
  return /^\d{15,}$/.test(local) && local === groupLocal;
}

/**
 * Prefer human name; fall back to phone / LID.
 * Never show the raw group id as the speaker.
 */
export function resolveWhatsAppSenderName(opts: {
  fromMe?: boolean;
  chatJid: string;
  sender?: unknown;
  pushName?: unknown;
  participant?: unknown;
  participantAlt?: unknown;
  senderName?: unknown;
  senderPhone?: unknown;
  senderLid?: unknown;
  contactName?: unknown;
}): { name: string | null; phone: string | null; label: string | null } {
  if (opts.fromMe) {
    return { name: 'You', phone: null, label: 'You' };
  }

  const groupLocal = jidLocalPart(opts.chatJid);
  const contact = String(opts.contactName || '').trim();
  const contactOk =
    contact &&
    contact.toLowerCase() !== 'me' &&
    contact.toLowerCase() !== 'unknown' &&
    !looksLikeGroupId(contact, opts.chatJid)
      ? contact
      : null;

  const push = String(opts.pushName || opts.senderName || '').trim();
  const pushOk =
    push &&
    push.toLowerCase() !== 'me' &&
    push.toLowerCase() !== 'unknown' &&
    !looksLikeGroupId(push, opts.chatJid)
      ? push
      : null;

  const phoneFromAlt = jidLocalPart(String(opts.participantAlt || ''));
  const phoneStored = jidLocalPart(String(opts.senderPhone || ''));
  const participantRaw = String(opts.participant || '').trim();
  const participantLocal = jidLocalPart(participantRaw);
  const participantIsLid = participantRaw.includes('@lid');

  const phone =
    phoneFromAlt ||
    phoneStored ||
    (!participantIsLid &&
    participantLocal &&
    participantLocal !== groupLocal &&
    !/^\d{15,}$/.test(participantLocal)
      ? participantLocal
      : '') ||
    null;

  const lid =
    jidLocalPart(String(opts.senderLid || '')) ||
    (participantIsLid && participantLocal !== groupLocal ? participantLocal : '') ||
    null;

  const sender = String(opts.sender || '').trim();
  const senderOk =
    sender &&
    sender.toLowerCase() !== 'me' &&
    sender.toLowerCase() !== 'unknown' &&
    !looksLikeGroupId(sender, opts.chatJid) &&
    sender !== pushOk &&
    sender !== contactOk
      ? sender
      : null;

  // If sender looks like a digit id and isn't the push name, treat as phone/lid
  const senderAsId =
    senderOk && /^\d{6,}$/.test(jidLocalPart(senderOk))
      ? jidLocalPart(senderOk)
      : null;

  const name =
    contactOk ||
    pushOk ||
    (senderOk && !senderAsId ? senderOk : null) ||
    null;

  const id = phone || senderAsId || lid || null;

  // Chat list: show name only (cleaner). Bubbles can still pass through label with phone.
  if (name && id && name !== id) {
    return { name, phone: id, label: name };
  }
  if (name) return { name, phone: id, label: name };
  if (id) return { name: null, phone: id, label: id };
  return { name: null, phone: null, label: null };
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
