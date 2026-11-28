import { describe, expect, it } from 'vitest'

import { renderRecord } from './record-markdown'

describe('renderRecord', () => {
  it('should draw the frontmatter as a list of terms ahead of the body', () => {
    const body = renderRecord(
      '---\ntitle: Surge advisories\ndescription: Items on alerts\n---\n\n# Surge advisories\n',
    )

    expect(body).toBe(
      '<dl class="fm"><dt>title</dt><dd>Surge advisories</dd><dt>description</dt><dd>Items on alerts</dd></dl><h4 class="t">Surge advisories</h4>',
    )
  })

  it('should keep a frontmatter value whole when it holds a colon', () => {
    const body = renderRecord(
      "---\ntitle: 'v03.2: Hear about a surge'\n---\n\nText\n",
    )

    expect(body).toBe(
      '<dl class="fm"><dt>title</dt><dd>v03.2: Hear about a surge</dd></dl><p>Text</p>',
    )
  })

  it('should set the title apart from every lower heading', () => {
    const body = renderRecord(
      '# Feature: Surge alerts\n\n## Summary\n\n### `queue.ts`\n',
    )

    expect(body).toBe(
      '<h4 class="t">Feature: Surge alerts</h4><h4>Summary</h4><h4><code>queue.ts</code></h4>',
    )
  })

  it('should draw a checked and an unchecked task as a box naming its state', () => {
    const body = renderRecord(
      '- [x] Saves the station\n- [ ] Reaches a phone\n',
    )

    expect(body).toBe(
      '<ul><li class="ck"><span class="box x" role="img" aria-label="done"></span><span>Saves the station</span></li><li class="ck"><span class="box" role="img" aria-label="not done"></span><span>Reaches a phone</span></li></ul>',
    )
  })

  it('should keep a plain list item as it is', () => {
    expect(renderRecord('- **Fix:** render the banner\n')).toBe(
      '<ul><li><b>Fix:</b> render the banner</li></ul>',
    )
  })

  it('should draw a table with its header and rows', () => {
    const body = renderRecord(
      '| Task | Session |\n| --- | --- |\n| `v03.2` | worker-c |\n',
    )

    expect(body).toBe(
      '<table><thead><tr><th>Task</th><th>Session</th></tr></thead><tbody><tr><td><code>v03.2</code></td><td>worker-c</td></tr></tbody></table>',
    )
  })

  it('should draw a markdown image as a placeholder naming its alt', () => {
    const body = renderRecord(
      '![box 3](https://example.org/frames/03-second-prompt.png?raw=true)\n',
    )

    expect(body).toBe('<p><span class="thumb">box 3</span></p>')
  })

  it('should draw an html image as a placeholder and load no remote address', () => {
    const body = renderRecord(
      '**390 · dark**\n\n<img src="https://example.org/station-save-dark-390.png" width="390" alt="station-save-dark-390 head">\n',
    )

    expect(body).toBe(
      '<p><b>390 · dark</b></p><span class="thumb">station-save-dark-390 head</span>',
    )
  })

  it('should drop a details wrapper and keep its summary and contents as text', () => {
    const body = renderRecord(
      '<details open>\n<summary>Passed (2)</summary>\n\n- Box one\n\n</details>\n',
    )

    expect(body).toBe('<p class="sum">Passed (2)</p><ul><li>Box one</li></ul>')
  })

  it('should leave no raw tag, comment, or line break tag in the page', () => {
    const body = renderRecord(
      'Reel:<br><img src="https://example.org/reel.webp" alt="reel">\n\n<!-- review-pr: commit=9d47e2a -->\n\n<div onclick="x()">kept out</div>\n',
    )

    expect(body).toBe('<p>Reel: <span class="thumb">reel</span></p>')
  })

  it('should draw a link as its text with no live address', () => {
    expect(
      renderRecord(
        '[line 41](https://example.org/q.ts#L41) and https://example.org\n',
      ),
    ).toBe(
      '<p><span class="ln">line 41</span> and <span class="ln">https://example.org</span></p>',
    )
  })

  it('should escape markup written as text', () => {
    expect(renderRecord('opens `/stations/<id>` & more\n')).toBe(
      '<p>opens <code>/stations/&lt;id&gt;</code> &amp; more</p>',
    )
  })
})
