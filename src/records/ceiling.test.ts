import { describe, expect, it } from 'vitest'
import { checkCeiling } from '@/records/ceiling'

const doc = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `line ${i}`).join('\n')

const read = (files: Record<string, string>) => (rel: string) => files[rel]

describe('checkCeiling', () => {
  const files = {
    'notes/near.md': doc(280),
    'notes/under.md': doc(279),
    'docs/guide.md': doc(180),
    'docs/short.md': doc(179),
    'notes/exempt.md': `<!-- canon-length-exempt: generated -->\n${doc(290)}`,
    'notes/other.md': doc(10),
    'src/a.ts': doc(290),
  }

  it('flags a near-ceiling target with no stated room', () => {
    const found = checkCeiling(
      ['- `notes/near.md`: add a section'],
      read(files),
    )

    expect(found.map((one) => one.subject)).toEqual(['notes/near.md'])
    expect(found[0].kind).toBe('ceiling-unstated')
  })

  it('accepts an entry naming a second markdown path', () => {
    const entries = ['- `notes/near.md`: new content goes to `notes/other.md`']

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('accepts an entry saying it adds no line', () => {
    const entries = ['- `notes/near.md`: replaces a clause, adds no line']

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('accepts a second path and the phrase together once', () => {
    const entries = [
      '- `notes/near.md`: adds no line, mirrors `notes/other.md`',
    ]

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('falls on the near side at exactly the margin and off it one under', () => {
    expect(checkCeiling(['- `notes/near.md`: x'], read(files))).toHaveLength(1)
    expect(checkCeiling(['- `notes/under.md`: x'], read(files))).toEqual([])
  })

  it('flags a docs page at the margin under its own 200 cap', () => {
    const found = checkCeiling(['- `docs/guide.md`: x'], read(files))

    expect(found.map((one) => one.subject)).toEqual(['docs/guide.md'])
    expect(found[0].message).toContain('180 or more of the 200 ceiling')
  })

  it('leaves a docs page one under its margin alone', () => {
    expect(checkCeiling(['- `docs/short.md`: x'], read(files))).toEqual([])
  })

  it('names the 300 ceiling for a document outside docs', () => {
    const found = checkCeiling(['- `notes/near.md`: x'], read(files))

    expect(found[0].message).toContain('280 or more of the 300 ceiling')
  })

  it('leaves an exempt document alone', () => {
    expect(checkCeiling(['- `notes/exempt.md`: x'], read(files))).toEqual([])
  })

  it('skips a path that does not exist yet', () => {
    expect(checkCeiling(['- `docs/new.md`: new file'], read(files))).toEqual([])
  })

  it('skips a non-markdown path', () => {
    expect(checkCeiling(['- `src/a.ts`: x'], read(files))).toEqual([])
  })

  it('does not measure a path cited only in the reason', () => {
    const entries = ['- `notes/other.md`: mirrors `notes/near.md`']

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('does not count a rename side before the colon as stated room', () => {
    const entries = ['- `notes/near.md` to `notes/other.md`: rename']

    expect(checkCeiling(entries, read(files))).toHaveLength(1)
  })

  it('joins a wrapped entry before reading its second path', () => {
    const entries = [
      '- `notes/near.md`: new content',
      '  goes to `notes/other.md`',
    ]

    expect(checkCeiling(entries, read(files))).toEqual([])
  })
})
