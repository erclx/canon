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
      { line: 1, column: 14, text: 'Prose sentence: another clause.' },
    ])
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
