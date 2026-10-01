/**
 * Allowlist sanitizer for TipTap output (task descriptions, comments, project docs).
 * Stored HTML is rendered with dangerouslySetInnerHTML, so everything outside the
 * editor's own vocabulary is dropped before it reaches the database.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'a',
  'img',
  'span',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

/** Elements whose text content must go too, not just the tags. */
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|noscript|template|svg|math|textarea|title|head)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const MENTION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Math.min(parseInt(hex, 16) || 0, 0x10ffff))
    )
    .replace(/&#(\d+);?/g, (_, dec: string) =>
      String.fromCodePoint(Math.min(parseInt(dec, 10) || 0, 0x10ffff))
    )
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string) {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** http(s), mailto, tel, same-origin paths and anchors only. */
function safeUrl(raw: string, allowed: RegExp): string | null {
  const decoded = decodeEntities(raw).replace(/[\u0000- \u007f]+/g, '');
  if (!decoded || !allowed.test(decoded)) return null;
  return decodeEntities(raw).trim();
}

const LINK_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;
const IMAGE_URL = /^(https?:|\/(?!\/))/i;

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(source))) {
    const name = match[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return '';
  const html = input.replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(DROP_WITH_CONTENT, '');

  let out = '';
  let cursor = 0;
  /** Whether each open <span> was emitted, so its closing tag matches. */
  const spanStack: boolean[] = [];

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(html))) {
    out += escapeText(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing) {
      if (VOID_TAGS.has(tag)) continue;
      if (tag === 'span') {
        if (spanStack.pop()) out += '</span>';
        continue;
      }
      out += `</${tag}>`;
      continue;
    }

    const attrs = parseAttrs(match[3] || '');

    if (tag === 'span') {
      const mentionId = attrs['data-mention-id'];
      const keep = !!mentionId && MENTION_ID_RE.test(mentionId);
      spanStack.push(keep);
      if (keep) out += `<span class="mention" data-mention-id="${mentionId}">`;
      continue;
    }

    if (tag === 'a') {
      const href = attrs.href ? safeUrl(attrs.href, LINK_URL) : null;
      out += href
        ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
        : '<a>';
      continue;
    }

    if (tag === 'img') {
      const src = attrs.src ? safeUrl(attrs.src, IMAGE_URL) : null;
      if (!src) continue;
      const alt = attrs.alt ? ` alt="${escapeAttr(decodeEntities(attrs.alt))}"` : '';
      out += `<img src="${escapeAttr(src)}"${alt}>`;
      continue;
    }

    out += `<${tag}>`;
  }

  out += escapeText(html.slice(cursor));
  while (spanStack.pop()) out += '</span>';
  return out;
}

/** True when the HTML has no visible text and no images. */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return (
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  );
}
