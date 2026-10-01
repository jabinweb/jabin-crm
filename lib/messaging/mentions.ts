/** Chat mentions are stored inline as `@[Display Name](userId)`. Pure helpers — safe on the client. */

export const CHAT_MENTION_RE = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g;

export function extractChatMentionIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of Array.from(content.matchAll(CHAT_MENTION_RE))) ids.add(match[2]);
  return Array.from(ids);
}

/** Readable text for previews, notifications and emails: `@[Rachel](id)` → `@Rachel`. */
export function chatPlainText(content: string): string {
  return content.replace(CHAT_MENTION_RE, (_m, name: string) => `@${name}`);
}

export type ChatSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; name: string; userId: string }
  | { type: 'link'; href: string };

const LINK_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** Split message text into renderable pieces (rendered as React nodes — never as HTML). */
export function chatSegments(content: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  const pushText = (text: string) => {
    let cursor = 0;
    for (const match of Array.from(text.matchAll(LINK_RE))) {
      const index = match.index ?? 0;
      if (index > cursor) segments.push({ type: 'text', text: text.slice(cursor, index) });
      segments.push({ type: 'link', href: match[0] });
      cursor = index + match[0].length;
    }
    if (cursor < text.length) segments.push({ type: 'text', text: text.slice(cursor) });
  };
  let cursor = 0;
  for (const match of Array.from(content.matchAll(CHAT_MENTION_RE))) {
    const index = match.index ?? 0;
    if (index > cursor) pushText(content.slice(cursor, index));
    segments.push({ type: 'mention', name: match[1], userId: match[2] });
    cursor = index + match[0].length;
  }
  if (cursor < content.length) pushText(content.slice(cursor));
  return segments;
}
