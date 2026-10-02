/**
 * Small Markdown → HTML converter for the rich-text editor's vocabulary (TipTap +
 * sanitizeRichText): headings, bold/italic/strike, inline code, links, bullet /
 * numbered / task lists, code fences, quotes and rules. Used for AI output, pasted
 * Markdown, and descriptions that were saved as raw Markdown text.
 */

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SAFE_LINK = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

/** Inline Markdown on one line of text (already split from block structure). */
export function inlineMarkdown(source: string): string {
  // Pull out code spans first so their contents aren't formatted
  const codes: string[] = [];
  let text = source.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  // [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label: string, url: string) =>
    SAFE_LINK.test(url) ? `<a href="${url.replace(/"/g, '&quot;')}">${label}</a>` : all
  );
  // Bare URLs
  text = text.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_, lead: string, url: string) => `${lead}<a href="${url}">${url}</a>`
  );
  text = text
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+?)~~/g, '<s>$1</s>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)] ?? '');
}

type ListKind = 'ul' | 'ol' | 'task';

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const TASK = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)\s*([\w+#-]*)\s*$/;

/** Convert a Markdown document to editor HTML. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { kind: ListKind; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    if (list.kind === 'task') out.push(`<ul data-type="taskList">${list.items.join('')}</ul>`);
    else out.push(`<${list.kind}>${list.items.join('')}</${list.kind}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${markdownToHtml(quote.join('\n'))}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };
  const addItem = (kind: ListKind, html: string) => {
    flushParagraph();
    flushQuote();
    if (!list || list.kind !== kind) {
      flushList();
      list = { kind, items: [] };
    }
    list.items.push(html);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${fence[1]}\\s*$`).test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      const lang = fence[2] ? ` class="language-${fence[2]}"` : '';
      out.push(`<pre><code${lang}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    flushQuote();

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      // The editor has two heading sizes: # / ## → h2, deeper → h3
      const tag = heading[1].length <= 2 ? 'h2' : 'h3';
      out.push(`<${tag}>${inlineMarkdown(heading[2])}</${tag}>`);
      continue;
    }

    if (RULE.test(line)) {
      flushAll();
      out.push('<hr>');
      continue;
    }

    const task = TASK.exec(line);
    if (task) {
      const checked = task[1].toLowerCase() === 'x';
      addItem(
        'task',
        `<li data-type="taskItem" data-checked="${checked}"><p>${inlineMarkdown(task[2])}</p></li>`
      );
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      addItem('ul', `<li><p>${inlineMarkdown(bullet[1])}</p></li>`);
      continue;
    }
    const ordered = ORDERED.exec(line);
    if (ordered) {
      addItem('ol', `<li><p>${inlineMarkdown(ordered[1])}</p></li>`);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flushAll();
  return out.join('');
}

/** Heuristic: does this plain text use Markdown structure worth converting? */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;
  let signals = 0;
  if (/^#{1,6}\s+\S/m.test(text)) signals += 2;
  if (/\*\*[^*\n]+\*\*/.test(text)) signals += 1;
  if (/^\s*[-*+]\s+\[( |x|X)\]\s/m.test(text)) signals += 2;
  if (/^\s*[-*+]\s+\S/m.test(text)) signals += 1;
  if (/^\s*\d+[.)]\s+\S/m.test(text)) signals += 1;
  if (/^\s*```/m.test(text)) signals += 2;
  if (/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(text)) signals += 1;
  return signals >= 2;
}

/**
 * Stored HTML that is really raw Markdown typed or pasted as text (only paragraphs and
 * line breaks, Markdown markers inside) → properly formatted HTML. Anything already
 * formatted is returned unchanged.
 */
export function upgradeMarkdownText(html: string): string {
  if (!html) return html;
  // Real formatting present → leave it alone
  if (/<(h[1-6]|ul|ol|li|strong|em|pre|blockquote|a)\b/i.test(html)) return html;
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/?p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  if (!looksLikeMarkdown(text)) return html;
  return markdownToHtml(text);
}
