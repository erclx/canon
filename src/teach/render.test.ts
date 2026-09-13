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
