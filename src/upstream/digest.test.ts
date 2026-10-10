import { describe, expect, it } from 'vitest'
import { buildDigest } from '@/upstream/digest'
import type { PageFetcher, Release } from '@/upstream/releases'

function release(version: string, lines: string[]): Release {
  return {
    tag_name: `v${version}`,
    published_at: '2026-10-01T00:00:00Z',
    body: lines.map((line) => `- ${line}`).join('\n'),
  }
}

function feed(releases: Release[]): PageFetcher {
  return async (page) => ({ ok: true, releases: page === 1 ? releases : [] })
}

const noFiles = async (): Promise<string[]> => []

describe('buildDigest', () => {
  it('should span from the cursor to the newest release', async () => {
    const digest = await buildDigest(
      '2.1.1',
      feed([
        release('2.1.3', ['Added c']),
        release('2.1.2', ['Added b']),
        release('2.1.1', ['Added a']),
      ]),
      noFiles,
    )

    expect(digest).toMatchObject({
      kind: 'digest',
      from: '2.1.1',
      to: '2.1.3',
      releases: 2,
    })
  })

  it('should list lines oldest release first', async () => {
    const digest = await buildDigest(
      '2.1.1',
      feed([
        release('2.1.3', ['Added c']),
        release('2.1.2', ['Added b']),
        release('2.1.1', []),
      ]),
      noFiles,
    )

    expect(digest.kind === 'digest' && digest.lines.map((l) => l.text)).toEqual(
      ['Added b', 'Added c'],
    )
  })

  it('should stay on the cursor when nothing is newer', async () => {
    const digest = await buildDigest(
      '2.1.1',
      feed([release('2.1.1', [])]),
      noFiles,
    )

    expect(digest).toMatchObject({ kind: 'digest', to: '2.1.1', lines: [] })
  })

  it('should attach only identifiers the checkout names', async () => {
    const grep = async (name: string): Promise<string[]> =>
      name === 'Foo-Bar' ? ['a.ts', 'b.ts'] : []

    const digest = await buildDigest(
      '2.1.1',
      feed([
        release('2.1.2', ['Changed `Foo-Bar` and `Baz-Qux`']),
        release('2.1.1', []),
      ]),
      grep,
    )

    expect(digest.kind === 'digest' && digest.lines[0]?.identifiers).toEqual([
      { name: 'Foo-Bar', files: ['a.ts', 'b.ts'] },
    ])
  })

  it('should pass a cursor missing from the feed through', async () => {
    const digest = await buildDigest(
      '2.0.0',
      feed([release('2.1.2', [])]),
      noFiles,
    )

    expect(digest).toEqual({ kind: 'cursor-missing', cursor: '2.0.0' })
  })
})
