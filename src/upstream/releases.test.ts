import { describe, expect, it } from 'vitest'
import {
  extractIdentifiers,
  keepLines,
  walkReleases,
  type PageFetcher,
  type Release,
} from '@/upstream/releases'

function release(
  version: string,
  lines: string[],
  date = '2026-10-01',
): Release {
  return {
    tag_name: `v${version}`,
    published_at: `${date}T00:00:00Z`,
    body: lines.map((line) => `- ${line}`).join('\n'),
  }
}

function pagesOf(pages: Release[][]): PageFetcher {
  return async (page) => ({ ok: true, releases: pages[page - 1] ?? [] })
}

describe('keepLines', () => {
  it('should keep an Added line and drop a Fixed one', () => {
    const lines = keepLines(
      release('2.1.2', ['Added `/foo` command', 'Fixed a crash on exit']),
    )

    expect(lines.map((line) => line.text)).toEqual(['Added `/foo` command'])
  })

  it.each([
    '[VSCode] Changed panel layout',
    'Windows: Added path support',
    'Added managed settings key',
    'Improved OpenTelemetry export',
    'Added Bedrock region flag',
    'Changed Vertex auth',
    'Added apps gateway route',
    'Self-hosted: Added runner flag',
    'Improved screen reader output',
  ])('should drop the noise line %s', (text) => {
    expect(keepLines(release('2.1.2', [text]))).toEqual([])
  })

  it.each(['Added', 'Changed', 'Removed', 'Improved', 'Deprecated'])(
    'should keep a line opening with %s',
    (verb) => {
      expect(
        keepLines(release('2.1.2', [`${verb} something real`])),
      ).toHaveLength(1)
    },
  )

  it('should keep a bullet nested under another and one written with a star', () => {
    const body = [
      '- Added top',
      '  - Changed nested',
      '* Removed starred',
    ].join('\n')

    const lines = keepLines({ ...release('2.1.2', []), body })

    expect(lines.map((line) => line.text)).toEqual([
      'Added top',
      'Changed nested',
      'Removed starred',
    ])
  })

  it('should carry the version and the date on every line', () => {
    const [line] = keepLines(release('2.1.9', ['Added x'], '2026-09-30'))

    expect(line).toMatchObject({ version: '2.1.9', date: '2026-09-30' })
  })

  it('should read a null body as no lines', () => {
    expect(keepLines({ ...release('2.1.2', []), body: null })).toEqual([])
  })
})

describe('extractIdentifiers', () => {
  it('should take a backticked name with a dash, slash, dot, or capital', () => {
    const found = extractIdentifiers(
      'Changed `--bg` and `a/b` and `x.y` and `SendMessage` and `plain`',
    )

    expect(found).toEqual(['--bg', 'a/b', 'x.y', 'SendMessage'])
  })

  it('should skip a name under three characters or over sixty', () => {
    const found = extractIdentifiers(
      `Changed \`a-\` and \`${'a-'.repeat(31)}\``,
    )

    expect(found).toEqual([])
  })

  it('should read only Changed, Removed, and Deprecated lines', () => {
    expect(extractIdentifiers('Added `Foo-Bar`')).toEqual([])
    expect(extractIdentifiers('Deprecated `Foo-Bar`')).toEqual(['Foo-Bar'])
  })
})

describe('walkReleases', () => {
  it('should stop at the cursor tag on the page that holds it', async () => {
    const pages = [
      [release('2.1.5', ['Added e']), release('2.1.4', ['Added d'])],
      [release('2.1.3', ['Added c']), release('2.1.2', ['Added b'])],
      [release('2.1.1', ['Added a'])],
    ]

    const walk = await walkReleases('2.1.3', pagesOf(pages), 2)

    expect(
      walk.kind === 'reached' && walk.releases.map((r) => r.tag_name),
    ).toEqual(['v2.1.5', 'v2.1.4'])
  })

  it('should not stop at the end of the first page when the cursor is on the second', async () => {
    const pages = [[release('2.1.4', ['Added d'])], [release('2.1.3', [])]]

    const walk = await walkReleases('2.1.3', pagesOf(pages), 1)

    expect(walk.kind === 'reached' && walk.releases).toHaveLength(1)
  })

  it('should report a cursor missing from the feed rather than reading back to the oldest', async () => {
    const pages = [[release('2.1.5', [])], [release('2.1.4', [])]]

    const walk = await walkReleases('2.0.0', pagesOf(pages), 1)

    expect(walk).toEqual({ kind: 'cursor-missing', cursor: '2.0.0' })
  })

  it('should surface a failed page as a refusal', async () => {
    const fetcher: PageFetcher = async () => ({
      ok: false,
      reason: 'rate-limited',
      message: 'limit',
    })

    const walk = await walkReleases('2.1.0', fetcher, 100)

    expect(walk).toEqual({
      kind: 'failed',
      reason: 'rate-limited',
      message: 'limit',
    })
  })

  it('should skip a draft release', async () => {
    const draft = { ...release('2.1.5', ['Added e']), draft: true }

    const walk = await walkReleases(
      '2.1.4',
      pagesOf([[draft, release('2.1.4', [])]]),
      100,
    )

    expect(walk.kind === 'reached' && walk.releases).toEqual([])
  })
})
