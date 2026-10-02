import { describe, expect, it } from '@jest/globals';
import { adfToHtml, htmlToAdf, isAdfDoc } from '@/lib/adf/adf';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';

const RICH_HTML =
  '<h2>Goal</h2>' +
  '<p><strong>Ship</strong> the <em>beta</em> — see <a href="https://jabin.org">docs</a> and <code>npm run build</code></p>' +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Write tests</p></li><li data-type="taskItem" data-checked="false"><p>Deploy</p></li></ul>' +
  '<ol><li><p>One</p></li><li><p>Two</p></li></ol>' +
  '<ul><li><p>Bullet</p></li></ul>' +
  '<blockquote><p>Quoted</p></blockquote>' +
  '<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>' +
  '<hr>' +
  '<p>Hi <span class="mention" data-mention-id="u1">@Jason</span></p>';

describe('ADF conversion', () => {
  it('maps editor HTML to the right ADF nodes', () => {
    const doc = htmlToAdf(RICH_HTML);
    expect(isAdfDoc(doc)).toBe(true);
    expect(doc.content.map((n) => n.type)).toEqual([
      'heading',
      'paragraph',
      'taskList',
      'orderedList',
      'bulletList',
      'blockquote',
      'codeBlock',
      'rule',
      'paragraph',
    ]);
    const task = doc.content[2];
    expect(task.content?.map((t) => t.attrs?.state)).toEqual(['DONE', 'TODO']);
    expect(task.content?.[0].content).toEqual([{ type: 'text', text: 'Write tests' }]);
    expect(doc.content[6]).toEqual({
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [{ type: 'text', text: 'const a = 1 < 2;' }],
    });
    const para = doc.content[1].content!;
    expect(para[0]).toEqual({ type: 'text', text: 'Ship', marks: [{ type: 'strong' }] });
    expect(para.find((n) => n.text === 'docs')?.marks).toEqual([
      { type: 'link', attrs: { href: 'https://jabin.org' } },
    ]);
    expect(doc.content[8].content?.[1]).toEqual({
      type: 'mention',
      attrs: { id: 'u1', text: '@Jason' },
    });
  });

  it('round-trips HTML → ADF → HTML without losing formatting', () => {
    const back = sanitizeRichText(adfToHtml(htmlToAdf(RICH_HTML)));
    expect(back).toBe(sanitizeRichText(RICH_HTML));
  });

  it('reads Jira ADF, keeping text of nodes the editor does not have', () => {
    const jira = {
      version: 1,
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'panel',
          attrs: { panelType: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside a panel' }] }],
        },
        { type: 'decisionList', content: [{ type: 'text', text: 'Decided' }] },
      ],
    };
    expect(adfToHtml(jira)).toBe('<h2>Title</h2><p>Inside a panel</p><p>Decided</p>');
    expect(adfToHtml(null)).toBe('');
  });

  it('never lets ADF inject markup', () => {
    const evil = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '<script>x</script>' },
            { type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
      ],
    };
    const html = sanitizeRichText(adfToHtml(evil));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
  });
});
