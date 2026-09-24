import { describe, expect, it } from 'vitest'
import { linkLessonReferences } from '@/teach/cross-references'

const CURRENT = '0002-groups.html'

function targets(
  entries: Record<string, string> = {
    '0001': '0001-anchors.html',
    '0002': CURRENT,
    '0003': '0003-lookaround.html',
  },
): ReadonlyMap<string, string> {
  return new Map(Object.entries(entries))
}

function link(text: string, href: string): string {
  return `<a href="${href}" data-lesson-ref>${text}</a>`
}

describe('linkLessonReferences', () => {
  it('should link a bare mention to the lesson file it names', () => {
    const linked = linkLessonReferences(
      '<p>See lesson 0001 first.</p>',
      targets(),
      CURRENT,
    )

    expect(linked).toEqual({
      html: `<p>See ${link('lesson 0001', '0001-anchors.html')} first.</p>`,
      unresolved: [],
    })
  })

  it('should keep the author casing of a capitalized mention', () => {
    const linked = linkLessonReferences(
      '<p>Lesson 0003 goes further.</p>',
      targets(),
      CURRENT,
    )

    expect(linked.html).toBe(
      `<p>${link('Lesson 0003', '0003-lookaround.html')} goes further.</p>`,
    )
  })

  it('should link a mention wrapped across a newline, keeping the break', () => {
    const linked = linkLessonReferences(
      '<p>as in lesson\n0001.</p>',
      targets(),
      CURRENT,
    )

    expect(linked.html).toBe(
      `<p>as in ${link('lesson\n0001', '0001-anchors.html')}.</p>`,
    )
  })

  it.each([
    ['a', '<a href="x.html">lesson 0001</a>'],
    ['code', '<code>lesson 0001</code>'],
    ['pre', '<pre><span>lesson 0001</span></pre>'],
    ['script', '<script>const s = "<b>lesson 0001"</script>'],
    ['style', '<style>/* lesson 0001 */</style>'],
    ['label', '<label><input type="radio"> lesson 0001</label>'],
    ['summary', '<summary>lesson 0001</summary>'],
    ['comment', '<!-- lesson 0001 -->'],
  ])('should leave a mention inside %s alone', (_element, html) => {
    const linked = linkLessonReferences(html, targets(), CURRENT)

    expect(linked).toEqual({ html, unresolved: [] })
  })

  it('should resume linking after a skipped element closes', () => {
    const linked = linkLessonReferences(
      '<p><code>lesson 0001</code> then lesson 0003</p>',
      targets(),
      CURRENT,
    )

    expect(linked.html).toBe(
      `<p><code>lesson 0001</code> then ${link('lesson 0003', '0003-lookaround.html')}</p>`,
    )
  })

  it('should leave a mention of the current lesson plain and unreported', () => {
    const html = '<p>This is lesson 0002.</p>'

    const linked = linkLessonReferences(html, targets(), CURRENT)

    expect(linked).toEqual({ html, unresolved: [] })
  })

  it('should report a number naming no lesson once and leave it plain', () => {
    const html = '<p>lesson 0009 and again lesson 0009</p>'

    const linked = linkLessonReferences(html, targets(), CURRENT)

    expect(linked).toEqual({ html, unresolved: ['0009'] })
  })

  it('should re-point a nav-owned link after its target slug changes', () => {
    const linked = linkLessonReferences(
      `<p>${link('lesson 0001', '0001-old-name.html')}</p>`,
      targets(),
      CURRENT,
    )

    expect(linked.html).toBe(
      `<p>${link('lesson 0001', '0001-anchors.html')}</p>`,
    )
  })

  it('should re-point a nav-owned link a formatter split across lines', () => {
    const linked = linkLessonReferences(
      '<p>from\n<a href="0001-old-name.html" data-lesson-ref>lesson 0001</a\n>.</p>',
      targets(),
      CURRENT,
    )

    expect(linked.html).toBe(
      `<p>from\n${link('lesson 0001', '0001-anchors.html')}.</p>`,
    )
  })

  it('should unwrap and report a nav-owned link whose target is gone', () => {
    const linked = linkLessonReferences(
      `<p>${link('lesson 0003', '0003-lookaround.html')}</p>`,
      targets({ '0001': '0001-anchors.html', '0002': CURRENT }),
      CURRENT,
    )

    expect(linked).toEqual({ html: '<p>lesson 0003</p>', unresolved: ['0003'] })
  })

  it('should be identical on a second pass over its own output', () => {
    const first = linkLessonReferences(
      '<p>lesson 0001, Lesson 0003, lesson 0009</p>',
      targets(),
      CURRENT,
    )

    const second = linkLessonReferences(first.html, targets(), CURRENT)

    expect(second).toEqual(first)
  })
})
