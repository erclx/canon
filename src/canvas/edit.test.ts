import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type ElementAddress, sourceElements } from '@/canvas/address'
import { contentHash, readSelection, writeSelection } from '@/canvas/content'
import {
  applyEdit,
  type EditChange,
  editFrame,
  editFrameAtIndex,
  restoreElement,
} from '@/canvas/edit'
import type { ElementState } from '@/canvas/history'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-edit-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

const FRAME = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <title>Hero</title>',
  '  </head>',
  '  <body>',
  '    <main class="hero">',
  '      <h1>Ship it</h1>',
  '      <p class="lead">Read <a href="#more">more</a></p>',
  '      <button style="color: red; padding: 4px">Start</button>',
  '    </main>',
  '  </body>',
  '</html>',
  '',
].join('\n')

function framePath(): string {
  return join(ROOT, '.canon', 'canvas', 'drafts', 'hero.html')
}

function seedFrame(html = FRAME): void {
  mkdirSync(join(framePath(), '..'), { recursive: true })
  writeFileSync(framePath(), html)
}

/** The address the shell would send for the first element with this tag. */
function addressOf(html: string, tag: string, withHash = true): ElementAddress {
  const elements = sourceElements(html)
  const address = {
    index: elements.findIndex((element) => element.tag === tag),
    tag,
    count: elements.length,
  }
  return withHash ? { ...address, hash: contentHash(html) } : address
}

function linesChanged(before: string, after: string): string[] {
  const left = before.split('\n')
  return after.split('\n').filter((line, at) => line !== left[at])
}

describe('applyEdit', () => {
  it('should add a style property to an element with no style', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'color',
      value: 'blue',
    })

    expect(outcome).toMatchObject({ ok: true })
    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      '      <h1 style="color: blue">Ship it</h1>',
    ])
  })

  it('should replace one property and keep the others in the style', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'button'), {
      property: 'color',
      value: 'green',
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      '      <button style="color: green; padding: 4px">Start</button>',
    ])
  })

  it('should append a new property after the ones already set', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'button'), {
      property: 'gap',
      value: '8px',
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      '      <button style="color: red; padding: 4px; gap: 8px">Start</button>',
    ])
  })

  it('should drop a property given an empty value', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'button'), {
      property: 'color',
      value: '',
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      '      <button style="padding: 4px">Start</button>',
    ])
  })

  it('should write a token as var() rather than the value it resolves to', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'background-color',
      value: 'var(--color-accent)',
    })

    expect(outcome.ok && outcome.html).toContain(
      '<h1 style="background-color: var(--color-accent)">',
    )
  })

  it('should leave every byte outside the edited element alone', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'font-size',
      value: '48px',
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toHaveLength(1)
    expect(outcome.ok && outcome.html.length).toBe(
      FRAME.length + ' style="font-size: 48px"'.length,
    )
  })

  it('should change the text of an element holding text alone', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'text',
      value: 'Ship <it> & go',
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      '      <h1>Ship &lt;it&gt; &amp; go</h1>',
    ])
  })

  it('should refuse text on an element holding other elements', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'p'), {
      property: 'text',
      value: 'flat',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'not-text-only' })
  })

  it('should refuse a property outside the basic set', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'box-shadow',
      value: 'none',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-edit' })
  })

  it('should refuse a value that would add a second declaration', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'color',
      value: 'red; position: fixed',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-edit' })
  })

  it.each([
    ['display', 'flex'],
    ['justify-content', 'center'],
    ['align-items', 'flex-end'],
    ['flex-wrap', 'wrap'],
    ['opacity', '0.5'],
    ['border-radius', '8px'],
    ['border-top-left-radius', '4px'],
    ['border-top-right-radius', '4px'],
    ['border-bottom-right-radius', '4px'],
    ['border-bottom-left-radius', '4px'],
    ['font-family', 'var(--type-body-family)'],
    ['line-height', '1.5'],
    ['letter-spacing', '-0.02em'],
    ['text-align', 'center'],
  ])('should write %s into the inline style', (property, value) => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property,
      value,
    })

    expect(outcome.ok && linesChanged(FRAME, outcome.html)).toEqual([
      `      <h1 style="${property}: ${value}">Ship it</h1>`,
    ])
  })

  it('should drop the corner longhands when the radius shorthand is set', () => {
    const html = FRAME.replace(
      '<h1>',
      '<h1 style="color: red; border-radius: 8px; border-top-left-radius: 0; margin: 2px">',
    )

    const outcome = applyEdit(html, addressOf(html, 'h1'), {
      property: 'border-radius',
      value: '12px',
    })

    expect(outcome.ok && linesChanged(html, outcome.html)).toEqual([
      '      <h1 style="color: red; border-radius: 12px; margin: 2px">Ship it</h1>',
    ])
  })

  it('should drop the side longhands when the padding shorthand is set', () => {
    const html = FRAME.replace(
      '<h1>',
      '<h1 style="padding-top: 1px; color: red;padding-left:3px">',
    )

    const outcome = applyEdit(html, addressOf(html, 'h1'), {
      property: 'padding',
      value: '4px',
    })

    expect(outcome.ok && linesChanged(html, outcome.html)).toEqual([
      '      <h1 style="color: red; padding: 4px">Ship it</h1>',
    ])
  })

  it('should append a longhand after its shorthand and keep the shorthand', () => {
    const html = FRAME.replace('<h1>', '<h1 style="border-radius: 8px">')

    const outcome = applyEdit(html, addressOf(html, 'h1'), {
      property: 'border-top-left-radius',
      value: '0',
    })

    expect(outcome.ok && linesChanged(html, outcome.html)).toEqual([
      '      <h1 style="border-radius: 8px; border-top-left-radius: 0">Ship it</h1>',
    ])
  })

  it('should keep a quoted family stack as one value beside the next declaration', () => {
    const html = FRAME.replace('<h1>', '<h1 style="color: red">')
    const first = applyEdit(html, addressOf(html, 'h1'), {
      property: 'font-family',
      value: '"Geist Variable", sans-serif',
    })
    const after = first.ok ? first.html : ''

    const second = applyEdit(after, addressOf(after, 'h1'), {
      property: 'font-family',
      value: 'serif',
    })

    expect(second.ok && linesChanged(FRAME, second.html)).toEqual([
      '      <h1 style="color: red; font-family: serif">Ship it</h1>',
    ])
  })

  it('should still refuse a property the set leaves out', () => {
    const outcome = applyEdit(FRAME, addressOf(FRAME, 'h1'), {
      property: 'transform',
      value: 'none',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-edit' })
  })

  it('should keep a byte order mark the file starts with', () => {
    const html = `﻿${FRAME}`

    const outcome = applyEdit(html, addressOf(html, 'h1'), {
      property: 'color',
      value: 'blue',
    })

    expect(outcome.ok && outcome.html.startsWith('﻿<!doctype')).toBe(true)
  })
})

describe('editFrame', () => {
  it('should write the edit into the frame file', () => {
    seedFrame()

    const outcome = editFrame(ROOT, 'drafts', 'hero', addressOf(FRAME, 'h1'), {
      property: 'color',
      value: 'blue',
    })

    const written = readFileSync(framePath(), 'utf8')
    expect(outcome).toEqual({
      ok: true,
      page: 'drafts',
      frame: 'hero',
      file: 'hero.html',
      hash: contentHash(written),
    })
    expect(written).toContain('<h1 style="color: blue">')
  })

  it('should refuse an edit made against a version the file moved past', () => {
    seedFrame()
    const address = addressOf(FRAME, 'h1')
    const rewritten = FRAME.replace('<h1>', '<h2>x</h2>\n      <h1>')
    writeFileSync(framePath(), rewritten)

    const outcome = editFrame(ROOT, 'drafts', 'hero', address, {
      property: 'color',
      value: 'blue',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'stale-address' })
    expect(readFileSync(framePath(), 'utf8')).toBe(rewritten)
  })

  it('should refuse an address the file cannot match', () => {
    seedFrame()

    const outcome = editFrame(
      ROOT,
      'drafts',
      'hero',
      { ...addressOf(FRAME, 'h1', false), count: 99 },
      { property: 'color', value: 'blue' },
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'address-mismatch' })
  })

  it('should refuse a frame that does not exist', () => {
    seedFrame()

    const outcome = editFrame(ROOT, 'drafts', 'gone', addressOf(FRAME, 'h1'), {
      property: 'color',
      value: 'blue',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'no-frame' })
  })

  it('should keep the selected element fresh across its own edit', () => {
    seedFrame()
    const address = addressOf(FRAME, 'h1')
    writeSelection(ROOT, { page: 'drafts', frame: 'hero', element: address })

    editFrame(ROOT, 'drafts', 'hero', address, {
      property: 'color',
      value: 'blue',
    })

    expect(readSelection(ROOT)?.element).toMatchObject({
      index: address.index,
      stale: false,
    })
  })

  it('should edit by index alone the element the file holds there', () => {
    seedFrame()
    const { index } = addressOf(FRAME, 'h1')

    const outcome = editFrameAtIndex(ROOT, 'drafts', 'hero', index, {
      property: 'color',
      value: 'blue',
    })

    expect(outcome).toMatchObject({ ok: true })
    expect(readFileSync(framePath(), 'utf8')).toContain(
      '<h1 style="color: blue">',
    )
  })

  it('should refuse an index past the elements the file holds', () => {
    seedFrame()

    const outcome = editFrameAtIndex(ROOT, 'drafts', 'hero', 400, {
      property: 'color',
      value: 'blue',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-address' })
  })

  it('should leave a stale selection stale', () => {
    seedFrame()
    const address = addressOf(FRAME, 'h1')
    writeSelection(ROOT, { page: 'drafts', frame: 'hero', element: address })
    const rewritten = FRAME.replace('Ship it', 'Ship')
    writeFileSync(framePath(), rewritten)

    editFrame(ROOT, 'drafts', 'hero', addressOf(rewritten, 'button'), {
      property: 'color',
      value: 'blue',
    })

    expect(readSelection(ROOT)?.element?.stale).toBe(true)
  })
})

describe('restoreElement', () => {
  /** Edits through the writer and hands back the states it observed. */
  function editObserved(html: string, tag: string, change: EditChange) {
    seedFrame(html)
    let states: { before: ElementState; after: ElementState } | undefined
    const outcome = editFrame(
      ROOT,
      'drafts',
      'hero',
      addressOf(html, tag),
      change,
      (observed) => {
        states = observed
      },
    )
    if (!outcome.ok || !states) throw new Error('the edit did not land')
    const { index, count } = addressOf(html, tag)
    return { ...states, index, count }
  }

  it('should bring every longhand back when a radius edit is undone', () => {
    const html = FRAME.replace(
      '<h1>',
      '<h1 style="border-top-left-radius: 2px; border-bottom-right-radius: 8px">',
    )
    const { before, after, index, count } = editObserved(html, 'h1', {
      property: 'border-radius',
      value: '4px',
    })

    const outcome = restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(outcome).toMatchObject({ ok: true })
    expect(readFileSync(framePath(), 'utf8')).toBe(html)
  })

  it('should restore a quoted family carrying an entity byte for byte', () => {
    const html = FRAME.replace(
      '<h1>',
      '<h1 style="font-family: &quot;Inter&quot;, sans-serif">',
    )
    const { before, after, index, count } = editObserved(html, 'h1', {
      property: 'color',
      value: 'blue',
    })

    restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(readFileSync(framePath(), 'utf8')).toBe(html)
  })

  it('should restore text holding an entity byte for byte', () => {
    const html = FRAME.replace('Ship it', 'Ship &amp; it')
    const { before, after, index, count } = editObserved(html, 'h1', {
      property: 'text',
      value: 'Launch <now>',
    })
    expect(readFileSync(framePath(), 'utf8')).toContain(
      '<h1>Launch &lt;now&gt;</h1>',
    )

    restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(readFileSync(framePath(), 'utf8')).toBe(html)
  })

  it('should reapply an undone edit', () => {
    const { before, after, index, count } = editObserved(FRAME, 'h1', {
      property: 'color',
      value: 'blue',
    })
    const edited = readFileSync(framePath(), 'utf8')
    restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      before,
      after,
    )

    expect(readFileSync(framePath(), 'utf8')).toBe(edited)
  })

  it('should refuse when the element changed since the edit', () => {
    const { before, after, index, count } = editObserved(FRAME, 'h1', {
      property: 'color',
      value: 'blue',
    })
    const rewritten = readFileSync(framePath(), 'utf8').replace(
      'color: blue',
      'color: green',
    )
    writeFileSync(framePath(), rewritten)

    const outcome = restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'changed' })
    expect(readFileSync(framePath(), 'utf8')).toBe(rewritten)
  })

  it('should refuse when another element now sits at the index', () => {
    const { before, after, index, count } = editObserved(FRAME, 'h1', {
      property: 'color',
      value: 'blue',
    })
    const shifted = readFileSync(framePath(), 'utf8').replace(
      '<main class="hero">',
      '<main class="hero">\n      <h2>New</h2>',
    )
    writeFileSync(framePath(), shifted)

    const outcome = restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'changed' })
    expect(readFileSync(framePath(), 'utf8')).toBe(shifted)
  })

  it('should refuse a redo once a same-tag unstyled element was inserted ahead of the target', () => {
    const html = FRAME.replace(
      '<main class="hero">',
      '<main class="hero">\n      <p>one</p>\n      <p>two</p>',
    )
    seedFrame(html)
    const elements = sourceElements(html)
    const target = elements.findIndex((element) => element.text === 'two')
    let states: { before: ElementState; after: ElementState } | undefined
    editFrame(
      ROOT,
      'drafts',
      'hero',
      {
        index: target,
        tag: 'p',
        count: elements.length,
        hash: contentHash(html),
      },
      { property: 'color', value: 'blue' },
      (observed) => {
        states = observed
      },
    )
    if (!states) throw new Error('the edit did not land')
    const address = { index: target, tag: 'p', count: elements.length }
    restoreElement(ROOT, 'drafts', 'hero', address, states.after, states.before)
    const shifted = readFileSync(framePath(), 'utf8').replace(
      '<p>one</p>',
      '<p>zero</p>\n      <p>one</p>',
    )
    writeFileSync(framePath(), shifted)

    const outcome = restoreElement(
      ROOT,
      'drafts',
      'hero',
      address,
      states.before,
      states.after,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'changed' })
    expect(readFileSync(framePath(), 'utf8')).toBe(shifted)
  })

  it('should apply when a different element in the frame changed', () => {
    const { before, after, index, count } = editObserved(FRAME, 'h1', {
      property: 'color',
      value: 'blue',
    })
    writeFileSync(
      framePath(),
      readFileSync(framePath(), 'utf8').replace('color: red', 'color: teal'),
    )

    const outcome = restoreElement(
      ROOT,
      'drafts',
      'hero',
      { index, tag: 'h1', count },
      after,
      before,
    )

    expect(outcome).toMatchObject({ ok: true })
    expect(readFileSync(framePath(), 'utf8')).toBe(
      FRAME.replace('color: red', 'color: teal'),
    )
  })
})
