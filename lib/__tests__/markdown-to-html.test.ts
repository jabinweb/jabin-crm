import { describe, expect, it } from '@jest/globals';
import {
  looksLikeMarkdown,
  markdownToHtml,
  upgradeMarkdownText,
} from '@/lib/html/markdown-to-html';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';

describe('markdownToHtml', () => {
  it('converts headings, bold labels and numbered lists (the founders agenda case)', () => {
    const md = [
      '### Meeting Agenda: Founders\' Commercial Agreement',
      '*Goal: Agree on the following points.*',
      '#### A. Ownership',
      '1. **Equity Split:** Confirm 34% (Rachael), 33% (Jason), 33% (Silas).',
      '2. **Economic Rights:** Confirm these apply to dividends.',
    ].join('\n');
    expect(markdownToHtml(md)).toBe(
      "<h3>Meeting Agenda: Founders' Commercial Agreement</h3>" +
        '<p><em>Goal: Agree on the following points.</em></p>' +
        '<h3>A. Ownership</h3>' +
        '<ol><li><p><strong>Equity Split:</strong> Confirm 34% (Rachael), 33% (Jason), 33% (Silas).</p></li>' +
        '<li><p><strong>Economic Rights:</strong> Confirm these apply to dividends.</p></li></ol>'
    );
  });

  it('makes checklists, code fences, links and quotes', () => {
    const html = markdownToHtml(
      '## Acceptance criteria\n- [ ] Works on mobile\n- [x] Has tests\n\n```ts\nconst a = 1 < 2;\n```\n\nSee [docs](https://example.com) or https://jabin.org\n\n> Note'
    );
    expect(html).toContain('<h2>Acceptance criteria</h2>');
    expect(html).toContain(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Works on mobile</p></li><li data-type="taskItem" data-checked="true"><p>Has tests</p></li></ul>'
    );
    expect(html).toContain('<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>');
    expect(html).toContain('<a href="https://example.com">docs</a>');
    expect(html).toContain('<a href="https://jabin.org">https://jabin.org</a>');
    expect(html).toContain('<blockquote><p>Note</p></blockquote>');
  });

  it('drops unsafe link targets and survives the sanitizer unchanged', () => {
    const html = markdownToHtml('[x](javascript:alert(1)) and **bold** <script>');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('&lt;script&gt;');
    const formatted = markdownToHtml('## Title\n- [ ] one\n1. **a:** b');
    expect(sanitizeRichText(formatted)).toBe(formatted);
  });
});

describe('looksLikeMarkdown / upgradeMarkdownText', () => {
  it('detects markdown but not ordinary prose', () => {
    expect(looksLikeMarkdown('### Title\n1. **a** b')).toBe(true);
    expect(looksLikeMarkdown('Call the client tomorrow about pricing.')).toBe(false);
  });

  it('upgrades paragraphs holding raw markdown and leaves formatted HTML alone', () => {
    const stored = '<p>### Agenda</p><p>1. **Roles:** Define them</p>';
    expect(upgradeMarkdownText(stored)).toBe(
      '<h3>Agenda</h3><ol><li><p><strong>Roles:</strong> Define them</p></li></ol>'
    );
    const formatted = '<h2>Agenda</h2><p>### not converted</p>';
    expect(upgradeMarkdownText(formatted)).toBe(formatted);
    expect(upgradeMarkdownText('<p>Just a note</p>')).toBe('<p>Just a note</p>');
  });
});
