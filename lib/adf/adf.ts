/**
 * Atlassian Document Format (ADF v1) ⇄ editor HTML.
 *
 * Descriptions are stored as sanitized HTML (lib/html/sanitize-rich-text.ts). These
 * converters let the API speak Jira's format too: `descriptionAdf` on reads, and ADF
 * accepted on writes. Only the editor's vocabulary is mapped; anything else in ADF
 * degrades to its text so nothing is silently lost.
 */

export type AdfMark = { type: string; attrs?: Record<string, unknown> };
export type AdfNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: AdfMark[];
};
export type AdfDoc = { version: 1; type: 'doc'; content: AdfNode[] };

// ── HTML → ADF ──────────────────────────────────────────────────────────────

type HtmlNode =
  | { kind: 'text'; text: string }
  | { kind: 'el'; tag: string; attrs: Record<string, string>; children: HtmlNode[] };

const VOID = new Set(['br', 'hr', 'img']);

function decode(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** Tiny tree builder for already-sanitized editor HTML. */
function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode = { kind: 'el', tag: 'root', attrs: {}, children: [] };
  const stack: Array<Extract<HtmlNode, { kind: 'el' }>> = [root as Extract<HtmlNode, { kind: 'el' }>];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const text = html.slice(cursor, m.index);
    if (text) stack[stack.length - 1].children.push({ kind: 'text', text: decode(text) });
    cursor = m.index + m[0].length;
    const tag = m[2].toLowerCase();
    if (m[1] === '/') {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const el = { kind: 'el' as const, tag, attrs: parseAttrs(m[3] || ''), children: [] as HtmlNode[] };
    stack[stack.length - 1].children.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3] || '')) stack.push(el);
  }
  const tail = html.slice(cursor);
  if (tail) stack[stack.length - 1].children.push({ kind: 'text', text: decode(tail) });
  return (root as Extract<HtmlNode, { kind: 'el' }>).children;
}

const MARK_FOR_TAG: Record<string, string> = {
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  s: 'strike',
  u: 'underline',
  code: 'code',
};

function inlineToAdf(nodes: HtmlNode[], marks: AdfMark[] = []): AdfNode[] {
  const out: AdfNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'text') {
      if (!node.text) continue;
      out.push(marks.length ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text });
      continue;
    }
    if (node.tag === 'br') {
      out.push({ type: 'hardBreak' });
      continue;
    }
    if (node.tag === 'span' && node.attrs['data-mention-id']) {
      out.push({
        type: 'mention',
        attrs: { id: node.attrs['data-mention-id'], text: textOf(node.children) },
      });
      continue;
    }
    if (node.tag === 'a') {
      const href = node.attrs.href;
      out.push(...inlineToAdf(node.children, href ? [...marks, { type: 'link', attrs: { href } }] : marks));
      continue;
    }
    const mark = MARK_FOR_TAG[node.tag];
    out.push(...inlineToAdf(node.children, mark ? [...marks, { type: mark }] : marks));
  }
  return out;
}

function textOf(nodes: HtmlNode[]): string {
  return nodes.map((n) => (n.kind === 'text' ? n.text : textOf(n.children))).join('');
}

function paragraph(content: AdfNode[]): AdfNode {
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

let taskSeq = 0;

function blocksToAdf(nodes: HtmlNode[]): AdfNode[] {
  const out: AdfNode[] = [];
  let loose: HtmlNode[] = [];
  const flushLoose = () => {
    const content = inlineToAdf(loose);
    if (content.some((n) => n.type !== 'text' || n.text?.trim())) out.push(paragraph(content));
    loose = [];
  };

  for (const node of nodes) {
    if (node.kind === 'text') {
      if (node.text.trim()) loose.push(node);
      continue;
    }
    const { tag, attrs, children } = node;
    const block = (n: AdfNode) => {
      flushLoose();
      out.push(n);
    };
    switch (tag) {
      case 'p':
        block(paragraph(inlineToAdf(children)));
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        block({ type: 'heading', attrs: { level: Number(tag[1]) }, content: inlineToAdf(children) });
        break;
      case 'ul':
        if (attrs['data-type'] === 'taskList') {
          block({
            type: 'taskList',
            attrs: { localId: `tl-${++taskSeq}` },
            content: children
              .filter((c): c is Extract<HtmlNode, { kind: 'el' }> => c.kind === 'el' && c.tag === 'li')
              .map((li) => ({
                type: 'taskItem',
                attrs: { localId: `ti-${++taskSeq}`, state: li.attrs['data-checked'] === 'true' ? 'DONE' : 'TODO' },
                // ADF task items hold inline content directly
                content: inlineToAdf(
                  li.children.flatMap((c) => (c.kind === 'el' && c.tag === 'p' ? c.children : [c]))
                ),
              })),
          });
        } else {
          block({ type: 'bulletList', content: listItems(children) });
        }
        break;
      case 'ol':
        block({ type: 'orderedList', attrs: { order: 1 }, content: listItems(children) });
        break;
      case 'blockquote':
        block({ type: 'blockquote', content: blocksToAdf(children) });
        break;
      case 'pre': {
        const code = children.find(
          (c): c is Extract<HtmlNode, { kind: 'el' }> => c.kind === 'el' && c.tag === 'code'
        );
        const language = code?.attrs.class?.replace(/^language-/, '') || undefined;
        const text = textOf(code ? code.children : children);
        block({
          type: 'codeBlock',
          ...(language ? { attrs: { language } } : {}),
          ...(text ? { content: [{ type: 'text', text }] } : {}),
        });
        break;
      }
      case 'hr':
        block({ type: 'rule' });
        break;
      case 'img':
        if (attrs.src) {
          block({
            type: 'mediaSingle',
            attrs: { layout: 'center' },
            content: [{ type: 'media', attrs: { type: 'external', url: attrs.src, alt: attrs.alt || '' } }],
          });
        }
        break;
      default:
        loose.push(node);
    }
  }
  flushLoose();
  return out;
}

function listItems(children: HtmlNode[]): AdfNode[] {
  return children
    .filter((c): c is Extract<HtmlNode, { kind: 'el' }> => c.kind === 'el' && c.tag === 'li')
    .map((li) => {
      const content = blocksToAdf(li.children);
      return { type: 'listItem', content: content.length ? content : [paragraph([])] };
    });
}

/** Editor HTML → ADF document. */
export function htmlToAdf(html: string | null | undefined): AdfDoc {
  taskSeq = 0;
  return { version: 1, type: 'doc', content: blocksToAdf(parseHtml(html ?? '')) };
}

// ── ADF → HTML ──────────────────────────────────────────────────────────────

function esc(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(text: string) {
  return esc(text).replace(/"/g, '&quot;');
}

function textWithMarks(node: AdfNode): string {
  let html = esc(node.text ?? '');
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'strong':
        html = `<strong>${html}</strong>`;
        break;
      case 'em':
        html = `<em>${html}</em>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        if (href) html = `<a href="${escAttr(href)}">${html}</a>`;
        break;
      }
    }
  }
  return html;
}

function inlineToHtml(nodes: AdfNode[] = []): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return textWithMarks(n);
        case 'hardBreak':
          return '<br>';
        case 'mention': {
          const id = String(n.attrs?.id ?? '');
          const label = String(n.attrs?.text ?? '');
          return id ? `<span class="mention" data-mention-id="${escAttr(id)}">${esc(label)}</span>` : esc(label);
        }
        case 'emoji':
          return esc(String(n.attrs?.text ?? n.attrs?.shortName ?? ''));
        case 'inlineCard':
          return n.attrs?.url ? `<a href="${escAttr(String(n.attrs.url))}">${esc(String(n.attrs.url))}</a>` : '';
        default:
          return inlineToHtml(n.content);
      }
    })
    .join('');
}

function blocksToHtml(nodes: AdfNode[] = []): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'paragraph':
          return `<p>${inlineToHtml(n.content)}</p>`;
        case 'heading': {
          // The editor has two heading sizes
          const level = Number(n.attrs?.level ?? 2) <= 2 ? 2 : 3;
          return `<h${level}>${inlineToHtml(n.content)}</h${level}>`;
        }
        case 'bulletList':
          return `<ul>${(n.content ?? []).map((li) => `<li>${blocksToHtml(li.content)}</li>`).join('')}</ul>`;
        case 'orderedList':
          return `<ol>${(n.content ?? []).map((li) => `<li>${blocksToHtml(li.content)}</li>`).join('')}</ol>`;
        case 'taskList':
          return `<ul data-type="taskList">${(n.content ?? [])
            .map((item) =>
              item.type === 'taskItem'
                ? `<li data-type="taskItem" data-checked="${item.attrs?.state === 'DONE'}"><p>${inlineToHtml(item.content)}</p></li>`
                : blocksToHtml([item])
            )
            .join('')}</ul>`;
        case 'blockquote':
          return `<blockquote>${blocksToHtml(n.content)}</blockquote>`;
        case 'codeBlock': {
          const lang = typeof n.attrs?.language === 'string' && n.attrs.language ? ` class="language-${escAttr(n.attrs.language)}"` : '';
          return `<pre><code${lang}>${esc((n.content ?? []).map((t) => t.text ?? '').join(''))}</code></pre>`;
        }
        case 'rule':
          return '<hr>';
        case 'mediaSingle':
        case 'mediaGroup':
          return (n.content ?? [])
            .map((media) =>
              typeof media.attrs?.url === 'string'
                ? `<img src="${escAttr(media.attrs.url)}" alt="${escAttr(String(media.attrs.alt ?? ''))}">`
                : ''
            )
            .join('');
        case 'panel':
        case 'expand':
        case 'nestedExpand':
        case 'layoutSection':
        case 'layoutColumn':
          return blocksToHtml(n.content);
        default:
          // Unknown blocks (tables, decisions…) keep their text
          return n.content ? `<p>${inlineToHtml(n.content)}</p>` : '';
      }
    })
    .join('');
}

/** ADF document → editor HTML (run the result through sanitizeRichText before storing). */
export function adfToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const content = (doc as { content?: unknown }).content;
  return Array.isArray(content) ? blocksToHtml(content as AdfNode[]) : '';
}

/** True for something shaped like an ADF document. */
export function isAdfDoc(value: unknown): value is AdfDoc {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'doc' &&
    Array.isArray((value as { content?: unknown }).content)
  );
}
