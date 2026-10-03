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
import { applyEdit, editFrame } from '@/canvas/edit'

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
