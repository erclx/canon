import { describe, expect, it } from 'vitest'
import { checkBundles } from '@/intake/bundles'

function cluster(items: Record<string, string>): string {
  return Object.entries(items)
    .map(([label, fix]) =>
      [
        `### ${label}. Something is wrong`,
        '',
        '- **Problem:** a measured defect',
        `- **Fix:** ${fix}`,
        '- **Worth it:** yes',
        '- **You:**',
        '',
      ].join('\n'),
    )
    .join('\n')
}

function overview(...rows: string[]): string {
  return ['# Dump', '', '## Ready', '', ...rows, ''].join('\n')
}

const SHARED = 'edit `src/a.ts`'
const CLEAN = { unshared: [], unresolved: [] }

describe('checkBundles', () => {
  it('should report nothing when every item cites the shared file', () => {
    const clusters = new Map([
      ['01-a.md', cluster({ '1': SHARED, '2': `also ${SHARED}` })],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `src/a.ts`, standing in for those items’ own rows',
    )

    expect(checkBundles(text, clusters)).toEqual(CLEAN)
  })

  it('should report a bundle whose items share a folder alone', () => {
    const clusters = new Map([
      [
        '01-a.md',
        cluster({ '1': 'edit `src/x/one.ts`', '2': 'edit `src/x/two.ts`' }),
      ],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `src/x/`',
    )

    const report = checkBundles(text, clusters)

    expect(report.unshared.map((row) => row.name)).toEqual(['a'])
    expect(report.unresolved).toEqual([])
  })

  it('should not count a path cited as a bare filename in one item', () => {
    const clusters = new Map([
      ['01-a.md', cluster({ '1': 'edit `src/a.ts`', '2': 'edit `a.ts`' })],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters).unshared).toHaveLength(1)
  })

  it('should count a plain-label link, a bare path, and a suffixed span as citing', () => {
    const clusters = new Map([
      [
        '01-a.md',
        cluster({
          '1': 'edit [a.ts](src/a.ts) in place',
          '2': 'edit src/a.ts, then the tests',
          '3': 'edit `src/a.ts:12` and `src/a.ts#parse`',
        }),
      ],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 to 3, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters)).toEqual(CLEAN)
  })

  it('should not count a longer path that merely contains the shared one', () => {
    const clusters = new Map([
      [
        '01-a.md',
        cluster({ '1': 'edit `src/a.ts`', '2': 'edit `lib/src/a.ts.bak`' }),
      ],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters).unshared).toHaveLength(1)
  })

  it('should accept any one shared path every item cites', () => {
    const clusters = new Map([
      [
        '01-a.md',
        cluster({
          '1': 'edit `src/a.ts`',
          '2': 'edit `src/a.ts` and `b.ts`',
        }),
      ],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `b.ts` and `src/a.ts`',
    )

    expect(checkBundles(text, clusters)).toEqual(CLEAN)
  })

  it('should expand a range of items', () => {
    const clusters = new Map([
      [
        '01-a.md',
        cluster({
          '1': SHARED,
          '2': SHARED,
          '3': SHARED,
          '4': 'edit `other.ts`',
        }),
      ],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 to 4, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters).unshared).toHaveLength(1)
  })

  it('should read a letter-suffixed item as its own item', () => {
    const clusters = new Map([
      ['01-a.md', cluster({ '1': SHARED, '1a': SHARED })],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 1a, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters)).toEqual(CLEAN)
  })

  it('should read items across two cluster files', () => {
    const clusters = new Map([
      ['01-a.md', cluster({ '1': SHARED })],
      ['02-b.md', cluster({ '2b': SHARED })],
    ])
    const text = overview(
      '- Bundle a: `01-a.md` item 1 and `02-b.md` item 2b, sharing `src/a.ts`',
    )

    expect(checkBundles(text, clusters)).toEqual(CLEAN)
  })

  it('should report a row naming an item that does not exist as unresolved', () => {
    const clusters = new Map([['01-a.md', cluster({ '1': SHARED })]])
    const text = overview(
      '- Bundle a: `01-a.md` items 1 and 2, sharing `src/a.ts`',
    )

    const report = checkBundles(text, clusters)

    expect(report.unshared).toEqual([])
    expect(report.unresolved).toHaveLength(1)
    expect(report.unresolved[0].message).toContain('item 2')
  })

  it('should report a bundle of one item as unresolved', () => {
    const clusters = new Map([['01-a.md', cluster({ '1': SHARED })]])
    const text = overview('- Bundle a: `01-a.md` item 1, sharing `src/a.ts`')

    expect(checkBundles(text, clusters).unresolved).toHaveLength(1)
  })

  it('should report a loosely worded row as unresolved', () => {
    const text = overview(
      '- Bundle a: every item in the three clusters, sharing `src/a.ts`',
    )

    const report = checkBundles(text, new Map())

    expect(report.unshared).toEqual([])
    expect(report.unresolved).toHaveLength(1)
    expect(report.unresolved[0].line).toBe(5)
  })

  it('should skip a bundle line inside a fenced sample', () => {
    const text = ['```markdown', '- Bundle a: loosely worded', '```'].join('\n')

    expect(checkBundles(text, new Map())).toEqual(CLEAN)
  })
})
