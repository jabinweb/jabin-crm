import { describe, expect, it } from '@jest/globals';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { extractMentionIds, newMentionIds } from '@/lib/projects/mention-html';

describe('sanitizeRichText', () => {
  it('keeps the editor vocabulary', () => {
    const html =
      '<h2>Plan</h2><p>Ship <strong>fast</strong> and <em>safe</em></p><ul><li>one</li></ul><blockquote>q</blockquote><pre><code>x</code></pre>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('drops scripts together with their content', () => {
    expect(sanitizeRichText('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
    expect(sanitizeRichText('<p>hi</p><script>alert(1)')).toBe('<p>hi</p>');
    expect(sanitizeRichText('<style>p{color:red}</style><p>hi</p>')).toBe('<p>hi</p>');
  });

  it('strips event handlers and unknown attributes', () => {
    expect(sanitizeRichText('<p onclick="alert(1)" style="x">hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeRichText('<img src="https://x.test/a.png" onerror="alert(1)">')).toBe(
      '<img src="https://x.test/a.png">'
    );
  });

  it('removes unknown tags but keeps their text', () => {
    expect(sanitizeRichText('<div><marquee>hello</marquee></div>')).toBe('hello');
  });

  it('rejects javascript: and data: urls, including obfuscated ones', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<a href="JaVa&#x73;cript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<a href="java\tscript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<a href="//evil.test">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).not.toContain(
      '<img'
    );
    expect(sanitizeRichText('<img src="javascript:alert(1)">')).toBe('');
  });

  it('forces safe link attributes', () => {
    expect(sanitizeRichText('<a href="https://x.test/?a=1&b=2" class="c">x</a>')).toBe(
      '<a href="https://x.test/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">x</a>'
    );
    expect(sanitizeRichText('<a href="/acme/dashboard">x</a>')).toContain('href="/acme/dashboard"');
  });

  it('escapes markup that is not a complete tag', () => {
    const out = sanitizeRichText('<p>1 < 2</p><img src=x onerror=alert(1)');
    expect(out).not.toMatch(/<img/);
    expect(out).toContain('&lt;img');
  });

  it('cannot be broken out of via attribute quoting', () => {
    const out = sanitizeRichText('<a href="https://x.test/&quot; onmouseover=&quot;alert(1)">x</a>');
    expect(out).not.toMatch(/"\s+onmouseover=/);
  });

  it('keeps mention chips and drops other spans', () => {
    expect(
      sanitizeRichText('<span class="mention" data-mention-id="cku1abc" style="x">@Priya</span>')
    ).toBe('<span class="mention" data-mention-id="cku1abc">@Priya</span>');
    expect(sanitizeRichText('<span style="color:red">plain</span>')).toBe('plain');
    expect(sanitizeRichText('<span data-mention-id="a b&quot;x">@x</span>')).toBe('@x');
  });

  it('handles empty input', () => {
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('isRichTextEmpty', () => {
  it('treats blank paragraphs as empty', () => {
    expect(isRichTextEmpty('<p></p>')).toBe(true);
    expect(isRichTextEmpty('<p>&nbsp; </p>')).toBe(true);
    expect(isRichTextEmpty(null)).toBe(true);
  });

  it('treats text or images as content', () => {
    expect(isRichTextEmpty('<p>hi</p>')).toBe(false);
    expect(isRichTextEmpty('<img src="/a.png">')).toBe(false);
  });
});

describe('mention parsing', () => {
  const a = '<span class="mention" data-mention-id="userA">@A</span>';
  const b = '<span class="mention" data-mention-id="userB">@B</span>';

  it('extracts unique mention ids', () => {
    expect(extractMentionIds(`<p>${a} ${b} ${a}</p>`)).toEqual(['userA', 'userB']);
    expect(extractMentionIds('<p>no one</p>')).toEqual([]);
    expect(extractMentionIds(null)).toEqual([]);
  });

  it('reports only newly added mentions', () => {
    expect(newMentionIds(`<p>${a}</p>`, `<p>${a} ${b}</p>`)).toEqual(['userB']);
    expect(newMentionIds(`<p>${a}</p>`, `<p>${a}</p>`)).toEqual([]);
    expect(newMentionIds(null, `<p>${a}</p>`)).toEqual(['userA']);
  });
});
