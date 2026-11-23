import { describe, expect, it } from 'vitest'
import { checkCeiling, NEAR_CEILING } from '@/records/ceiling'

const doc = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `line ${i}`).join('\n')

const read = (files: Record<string, string>) => (rel: string) => files[rel]

describe('checkCeiling', () => {
  const files = {
    'docs/near.md': doc(NEAR_CEILING),
    'docs/under.md': doc(NEAR_CEILING - 1),
    'docs/exempt.md': `<!-- canon-length-exempt: generated -->\n${doc(290)}`,
    'docs/other.md': doc(10),
    'src/a.ts': doc(290),
  }

  it('flags a near-ceiling target with no stated room', () => {
    const found = checkCeiling(['- `docs/near.md`: add a section'], read(files))

    expect(found.map((one) => one.subject)).toEqual(['docs/near.md'])
    expect(found[0].kind).toBe('ceiling-unstated')
  })

  it('accepts an entry naming a second markdown path', () => {
    const entries = ['- `docs/near.md`: new content goes to `docs/other.md`']

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('falls on the near side at exactly the margin and off it one under', () => {
    expect(checkCeiling(['- `docs/near.md`: x'], read(files))).toHaveLength(1)
    expect(checkCeiling(['- `docs/under.md`: x'], read(files))).toEqual([])
  })

  it('leaves an exempt document alone', () => {
    expect(checkCeiling(['- `docs/exempt.md`: x'], read(files))).toEqual([])
  })

  it('skips a path that does not exist yet', () => {
    expect(checkCeiling(['- `docs/new.md`: new file'], read(files))).toEqual([])
  })

  it('skips a non-markdown path', () => {
    expect(checkCeiling(['- `src/a.ts`: x'], read(files))).toEqual([])
  })

  it('does not measure a path cited only in the reason', () => {
    const entries = ['- `docs/other.md`: mirrors `docs/near.md`']

    expect(checkCeiling(entries, read(files))).toEqual([])
  })

  it('joins a wrapped entry before reading its second path', () => {
    const entries = [
      '- `docs/near.md`: new content',
      '  goes to `docs/other.md`',
    ]

    expect(checkCeiling(entries, read(files))).toEqual([])
  })
})
