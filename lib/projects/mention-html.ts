/** Pure helpers for reading @mentions out of rich text (no DB access). */

const MENTION_ATTR_RE = /data-mention-id="([A-Za-z0-9_-]{1,64})"/g;

/** User ids tagged with @ in a piece of rich text. */
export function extractMentionIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  MENTION_ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_ATTR_RE.exec(html))) ids.add(match[1]);
  return Array.from(ids);
}

/** Mentions present in `next` that were not already in `previous`. */
export function newMentionIds(
  previous: string | null | undefined,
  next: string | null | undefined
): string[] {
  const before = new Set(extractMentionIds(previous));
  return extractMentionIds(next).filter((id) => !before.has(id));
}
