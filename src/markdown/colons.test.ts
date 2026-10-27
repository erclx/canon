import { describe, expect, it } from 'vitest'
import { findColons } from '@/markdown/colons'
import { bodyLines } from '@/markdown/scan'

function colonsIn(source: string) {
  return findColons(bodyLines(`${source}\n`))
}

describe('findColons', () => {
  it('should report a colon joining two clauses in a prose sentence', () => {
    const found = colonsIn('Prose sentence: another clause.')

    expect(found).toEqual([
      {
        line: 1,
        column: 14,
        text: 'Prose sentence: another clause.',
        lead: 'sentence',
      },
    ])
  })

  it('should name the word before the colon after an emoji', () => {
    // The column is a UTF-16 offset, so the lead is carried rather than left
    // for a reader counting code points to slice out of the text.
    const found = colonsIn('Ship it 🚀 now: it works.')

    expect(found.map((hit) => hit.lead)).toEqual(['now'])
  })

  it('should report a colon after the label position in a list item', () => {
    const found = colonsIn('- Label: the fix is simple: split it.')

    expect(found.map((hit) => hit.column)).toEqual([26])
  })

  it('should not report a bullet label', () => {
    expect(colonsIn('- Problem: the text follows')).toEqual([])
  })

  it('should not report a numbered step label', () => {
    expect(colonsIn('1. Step: text')).toEqual([])
  })

  it('should not report a bold label, whether the colon sits inside or after', () => {
    expect(colonsIn('- **Problem:** text')).toEqual([])
    expect(colonsIn('**Problem**: text')).toEqual([])
  })

  it('should not report a code span label', () => {
    expect(colonsIn('- `src/`: description')).toEqual([])
  })

  it('should not report a file entry naming several paths at any length', () => {
    const entry =
      '- `a/one.ts`, `a/two.ts`, `a/three.ts`, `a/four.ts`, `a/five.ts`, and `a/six.ts`: the change'

    expect(colonsIn(entry)).toEqual([])
  })

  it('should not report a rename entry joining two paths with to', () => {
    expect(colonsIn('- `old.ts` to `new.ts`: move it')).toEqual([])
  })

  it('should not report a lead of links and commas', () => {
    expect(colonsIn('- [one](a.md), [two](b.md): sources')).toEqual([])
  })

  it('should report a long prose lead in a list item', () => {
    const found = colonsIn('- One more long lead of plain words: the text')

    expect(found.map((hit) => hit.lead)).toEqual(['words'])
  })

  it('should not report the lead of every item in a uniform list', () => {
    const source = [
      '- Open at the tip when it is stale: fix it',
      '- Closed when nothing is left to address: reply',
      '- Pending until the reviewer posts again: wait',
    ].join('\n')

    expect(colonsIn(source)).toEqual([])
  })

  it('should report the colon items of a list where one item lacks a colon', () => {
    const source = [
      '- Open at the tip when it is stale: fix it',
      '- Closed when nothing is left to address',
      '- Pending until the reviewer posts again: wait',
    ].join('\n')

    expect(colonsIn(source).map((hit) => hit.line)).toEqual([1, 3])
  })

  it('should report a lone prose bullet among colon-less siblings', () => {
    const source = [
      '- First sibling without one',
      '- Second sibling holds a long lead here: the text',
      '- Third sibling without one',
    ].join('\n')

    expect(colonsIn(source).map((hit) => hit.line)).toEqual([2])
  })

  it('should report a second colon inside a label item', () => {
    const source = [
      '- A long lead for the first item: one: two',
      '- A long lead for the second item: three',
    ].join('\n')

    expect(colonsIn(source).map((hit) => hit.column)).toEqual([37])
  })

  it('should judge each side of a blank line as its own list', () => {
    const source = [
      '- A long lead for the first item: one',
      '',
      '- A long lead for the second item: two',
    ].join('\n')

    expect(colonsIn(source).map((hit) => hit.line)).toEqual([1, 3])
  })

  it('should let a nested child neither join nor break its parent list', () => {
    const source = [
      '- A long lead for the first item: one',
      '  - A child without a colon',
      '- A long lead for the second item: two',
    ].join('\n')

    expect(colonsIn(source)).toEqual([])
  })

  it('should group a list inside a block quote', () => {
    const source = [
      '> - A long lead for the first item: one',
      '> - A long lead for the second item: two',
    ].join('\n')

    expect(colonsIn(source)).toEqual([])
  })

  it('should count an item whose only colon sits in a code span as carrying none', () => {
    const source = [
      '- A long lead for the first item: one',
      '- A long lead for the second `item: two`',
    ].join('\n')

    expect(colonsIn(source).map((hit) => hit.line)).toEqual([1])
  })

  it('should not report a line-final colon', () => {
    expect(colonsIn('Run these in order:')).toEqual([])
  })

  it('should not report a time or a URL', () => {
    expect(
      colonsIn('Meet at 10:30 or read https://example.com/a:b today.'),
    ).toEqual([])
  })

  it('should not report a colon inside a code span', () => {
    expect(colonsIn('Pass `key: value` to the verb.')).toEqual([])
  })

  it('should not report a colon in link text or a destination', () => {
    expect(colonsIn('See [Step: one](docs/a:b.md) for more.')).toEqual([])
  })

  it('should not report a fenced line, a heading, or a table row', () => {
    const source = [
      '```yaml',
      'key: value',
      '```',
      '## Step 1: read',
      '| a: b | c |',
    ].join('\n')

    expect(colonsIn(source)).toEqual([])
  })
})
