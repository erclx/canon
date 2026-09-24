import { describe, expect, it } from 'vitest'
import { renderLessonBody } from '@/teach/render'

describe('renderLessonBody', () => {
  it('should render a heading block', () => {
    const outcome = renderLessonBody([
      { type: 'heading', level: 1, text: 'Compass bearings' },
    ])
    expect(outcome).toEqual({ ok: true, html: '<h1>Compass bearings</h1>' })
  })

  it('should render a paragraph block', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'Hold the compass level.' },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: '<p>Hold the compass level.</p>',
    })
  })

  it('should render a lede paragraph block', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'A bearing is a direction.', lede: true },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: '<p class="lede">A bearing is a direction.</p>',
    })
  })

  it('should render a list block', () => {
    const outcome = renderLessonBody([
      { type: 'list', items: ['Point', 'Rotate', 'Read'], ordered: true },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: '<ol><li>Point</li><li>Rotate</li><li>Read</li></ol>',
    })
  })

  it('should render a raw block unescaped', () => {
    const outcome = renderLessonBody([
      { type: 'raw', html: '<div class="quiz">quiz markup</div>' },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: '<div class="quiz">quiz markup</div>',
    })
  })

  it('should compose a multi-block body', () => {
    const outcome = renderLessonBody([
      { type: 'heading', level: 1, text: 'Compass bearings' },
      { type: 'paragraph', text: 'A bearing is a direction.', lede: true },
      { type: 'list', items: ['Point', 'Rotate'] },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: [
        '<h1>Compass bearings</h1>',
        '<p class="lede">A bearing is a direction.</p>',
        '<ul><li>Point</li><li>Rotate</li></ul>',
      ].join('\n'),
    })
  })

  it('should pass a raw block through unescaped beside an adjacent block still escaped', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'Failure modes & rollback' },
      { type: 'raw', html: '<em>already rendered</em>' },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: [
        '<p>Failure modes &amp; rollback</p>',
        '<em>already rendered</em>',
      ].join('\n'),
    })
  })

  it('should refuse an unrecognized block type', () => {
    const outcome = renderLessonBody([
      { type: 'heading', level: 1, text: 'ok' },
      { type: 'quote', text: 'not a real block' },
    ])
    expect(outcome).toEqual({
      ok: false,
      reason: 'bad-input',
      message: 'Block 1: unrecognized type "quote"',
      detail: [],
    })
  })

  it('should refuse a list block missing items rather than throw', () => {
    const outcome = renderLessonBody([{ type: 'list', ordered: true }])
    expect(outcome).toEqual({
      ok: false,
      reason: 'bad-input',
      message: 'Block 0: list needs an items array of strings',
      detail: [],
    })
  })

  it('should refuse a heading block with an out-of-range level', () => {
    const outcome = renderLessonBody([
      { type: 'heading', level: 3, text: 'too deep' },
    ])
    expect(outcome).toEqual({
      ok: false,
      reason: 'bad-input',
      message: 'Block 0: heading needs level 1 or 2',
      detail: [],
    })
  })

  it('should refuse a raw block whose html is not a string', () => {
    const outcome = renderLessonBody([{ type: 'raw', html: 42 }])
    expect(outcome).toEqual({
      ok: false,
      reason: 'bad-input',
      message: 'Block 0: raw needs a string html',
      detail: [],
    })
  })
})

describe('renderLessonBody citations', () => {
  const REFS_BLOCK = {
    type: 'refs',
    items: [
      { title: 'Compass manual', url: 'https://example.com/compass' },
      { title: 'Field notes', note: 'Recorded on the ridge' },
    ],
  }

  it('should render a paragraph carrying cites as markers after its text', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'North is fixed.', cites: [1, 2] },
      REFS_BLOCK,
    ])
    expect(outcome).toMatchObject({
      ok: true,
      html: expect.stringContaining(
        '<p>North is fixed.' +
          '<sup class="cite"><a href="#r1">1</a></sup>' +
          '<sup class="cite"><a href="#r2">2</a></sup></p>',
      ),
    })
  })

  it('should render a refs block with and without a url and note', () => {
    const outcome = renderLessonBody([REFS_BLOCK])
    expect(outcome).toEqual({
      ok: true,
      html:
        '<ol class="refs">' +
        '<li id="r1"><cite>Compass manual</cite> <a href="https://example.com/compass">example.com</a></li>' +
        '<li id="r2"><cite>Field notes</cite>. Recorded on the ridge</li>' +
        '</ol>',
    })
  })

  it('should escape a reference title carrying markup characters', () => {
    const outcome = renderLessonBody([
      { type: 'refs', items: [{ title: 'Maps & <legends>' }] },
    ])
    expect(outcome).toEqual({
      ok: true,
      html: '<ol class="refs"><li id="r1"><cite>Maps &amp; &lt;legends&gt;</cite></li></ol>',
    })
  })

  it('should refuse cites that are not positive integers', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'North.', cites: [0] },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message:
        'Block 0: paragraph cites must be a non-empty array of positive integers',
    })
  })

  it('should refuse an empty cites array', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'North.', cites: [] },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message:
        'Block 0: paragraph cites must be a non-empty array of positive integers',
    })
  })

  it('should refuse cites on a lede paragraph', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'A bearing.', lede: true, cites: [1] },
      REFS_BLOCK,
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: a lede paragraph cannot carry cites',
    })
  })

  it('should refuse a refs block with no items', () => {
    const outcome = renderLessonBody([{ type: 'refs', items: [] }])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: refs needs a non-empty items array',
    })
  })

  it('should refuse a reference with an empty title', () => {
    const outcome = renderLessonBody([{ type: 'refs', items: [{ title: '' }] }])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: reference 1 needs a non-empty string title',
    })
  })

  it('should refuse a reference whose note is not a string', () => {
    const outcome = renderLessonBody([
      { type: 'refs', items: [{ title: 'Manual', note: 3 }] },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: reference 1 note must be a string',
    })
  })

  it('should refuse a reference url that is not http or https', () => {
    const outcome = renderLessonBody([
      {
        type: 'refs',
        items: [{ title: 'Manual', url: 'javascript:alert(1)' }],
      },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: reference 1 url must be an http or https URL',
    })
  })

  it('should refuse a reference url that does not parse', () => {
    const outcome = renderLessonBody([
      { type: 'refs', items: [{ title: 'Manual', url: 'not a url' }] },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: reference 1 url must be an http or https URL',
    })
  })

  it('should refuse a second refs block', () => {
    const outcome = renderLessonBody([REFS_BLOCK, REFS_BLOCK])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 1: a lesson carries one refs block',
    })
  })

  it('should refuse a cite past the reference count, naming the citing block', () => {
    const outcome = renderLessonBody([
      { type: 'heading', level: 1, text: 'Bearings' },
      { type: 'paragraph', text: 'North.', cites: [3] },
      REFS_BLOCK,
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 1: cite 3 resolves to no reference',
    })
  })

  it('should refuse a cite when no refs block is present', () => {
    const outcome = renderLessonBody([
      { type: 'paragraph', text: 'North.', cites: [1] },
    ])
    expect(outcome).toMatchObject({
      ok: false,
      message: 'Block 0: cite 1 resolves to no reference',
    })
  })
})
