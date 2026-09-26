import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  citedPaths,
  type StaleEntry,
  type StaleReport,
  staleMemory,
} from '@/records/stale'

let ROOT: string

/** Pinned at local noon so a window boundary never lands on a DST shift. */
const NOW = Date.parse('2026-09-26T12:00:00')

interface EntryFixture {
  readonly reviewed?: string
  readonly body?: string
  readonly folder?: string
  readonly root?: string
}

function writeEntry(name: string, fixture: EntryFixture = {}): void {
  const type = name.split('-')[0]
  const category = type.charAt(0).toUpperCase() + type.slice(1)
  const lines = [
    '---',
    `title: A rule for ${name}`,
    `description: What ${name} settles`,
    `category: ${category}`,
    ...(fixture.reviewed === undefined
      ? []
      : [`reviewed: ${fixture.reviewed}`]),
    '---',
    '',
    fixture.body ?? 'The rule.',
    '',
  ]
  const path = join(
    ROOT,
    fixture.root ?? '.canon',
    'memory',
    ...(fixture.folder ? [fixture.folder] : []),
    `${name}.md`,
  )
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, lines.join('\n'))
}

function writeTreeFile(path: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, '')
}

async function readPen(days = 30): Promise<StaleReport> {
  const outcome = await staleMemory(ROOT, days, NOW)
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome
}

function names(entries: readonly StaleEntry[]): string[] {
  return entries.map((entry) => entry.name)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-stale-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('staleMemory ordering', () => {
  it('should order an unresolved-path entry ahead of an older reviewed one', async () => {
    writeEntry('project-older', { reviewed: '2026-01-01' })
    writeEntry('project-moved', {
      reviewed: '2026-08-01',
      body: 'See `src/gone.ts`.',
    })

    const report = await readPen()

    expect(names(report.entries)).toEqual(['project-moved', 'project-older'])
  })

  it('should order a never-reviewed entry ahead of a recently reviewed one', async () => {
    writeEntry('feedback-recent', { reviewed: '2026-09-20' })
    writeEntry('feedback-never')

    const report = await readPen()

    expect(names(report.entries)).toEqual(['feedback-never', 'feedback-recent'])
  })

  it('should order due entries by oldest review, then by name', async () => {
    writeEntry('project-b', { reviewed: '2026-03-01' })
    writeEntry('project-a', { reviewed: '2026-03-01' })
    writeEntry('project-c', { reviewed: '2026-01-01' })

    const report = await readPen()

    expect(names(report.entries)).toEqual([
      'project-c',
      'project-a',
      'project-b',
    ])
  })

  it('should mark an entry reviewed inside the window as not due', async () => {
    writeEntry('project-kept', { reviewed: '2026-09-20' })
    writeEntry('project-old', { reviewed: '2026-06-01' })

    const report = await readPen()

    expect(report.entries.map((entry) => [entry.name, entry.due])).toEqual([
      ['project-old', true],
      ['project-kept', false],
    ])
    expect(report.due).toBe(1)
  })

  it('should take the window from the days argument', async () => {
    writeEntry('project-kept', { reviewed: '2026-09-20' })

    const report = await readPen(3)

    expect(report.entries[0].due).toBe(true)
  })
})

describe('staleMemory reviewed field', () => {
  it('should read a malformed reviewed value as never reviewed and name it', async () => {
    writeEntry('project-bad', { reviewed: 'last week' })

    const report = await readPen()

    expect(report.entries[0]).toMatchObject({
      reviewed: null,
      due: true,
      invalidReviewed: 'last week',
    })
  })

  it('should read a quoted date the same as a bare one', async () => {
    writeEntry('project-quoted', { reviewed: "'2026-09-20'" })

    const report = await readPen()

    expect(report.entries[0]).toMatchObject({
      reviewed: '2026-09-20',
      due: false,
    })
  })

  it('should read the reviewed field from an entry with CRLF line endings', async () => {
    const dir = join(ROOT, '.canon', 'memory')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'user-crlf.md'),
      [
        '---',
        'title: A rule',
        'description: What it settles',
        'category: User',
        'reviewed: 2026-09-20',
        '---',
        '',
        'The fact.',
        '',
      ].join('\r\n'),
    )

    const report = await readPen()

    expect(report.entries[0]).toMatchObject({
      reviewed: '2026-09-20',
      due: false,
    })
  })

  it('should report the category and a null reviewed on an entry without the field', async () => {
    writeEntry('user-role')

    const report = await readPen()

    expect(report.entries[0]).toEqual({
      name: 'user-role',
      category: 'User',
      reviewed: null,
      due: true,
      unresolved: [],
    })
  })
})

describe('staleMemory path resolution', () => {
  it('should report a cited path absent from the root and pass one present', async () => {
    writeTreeFile('src/here.ts')
    writeEntry('project-paths', {
      body: 'See `src/here.ts` and `src/gone.ts`.',
    })

    const report = await readPen()

    expect(report.entries[0].unresolved).toEqual(['src/gone.ts'])
  })

  it('should strip a line anchor or a heading anchor before resolving', async () => {
    writeTreeFile('src/here.ts')
    writeTreeFile('docs/page.md')
    writeEntry('project-anchors', {
      body: 'See `src/here.ts:12`, `src/here.ts:12-20`, and `docs/page.md#usage`.',
    })

    const report = await readPen()

    expect(report.entries[0].unresolved).toEqual([])
  })

  it('should resolve against the project root rather than the entry folder', async () => {
    writeTreeFile('.canon/memory/notes/local.md')
    writeEntry('project-relative', { body: 'See `notes/local.md`.' })

    const report = await readPen()

    expect(report.entries[0].unresolved).toEqual(['notes/local.md'])
  })

  it('should never report a token under a record root or holding a placeholder or glob', async () => {
    writeEntry('project-skipped', {
      body: [
        '`.canon/plans/feature-x.md`',
        '`.canon/tmp/slug/file.md`',
        // canon-keep-record-root
        '`.claude/.tmp/slug/file.md`',
        '`.claude/worktrees/name/file.ts`',
        '`src/<name>.ts`',
        '`src/**/*.ts`',
      ].join(' '),
    })

    const report = await readPen()

    expect(report.entries[0].unresolved).toEqual([])
  })

  it('should report the same missing path once', async () => {
    writeEntry('project-twice', { body: '`src/gone.ts` and `src/gone.ts`.' })

    const report = await readPen()

    expect(report.entries[0].unresolved).toEqual(['src/gone.ts'])
  })
})

describe('staleMemory folder scope', () => {
  it('should never read review, archive, or the index', async () => {
    writeEntry('project-live')
    writeEntry('project-receipt', { folder: 'review' })
    writeEntry('project-retired', { folder: 'archive' })
    writeFileSync(join(ROOT, '.canon', 'memory', 'index.md'), '# Memory\n')

    const report = await readPen()

    expect(names(report.entries)).toEqual(['project-live'])
  })

  it('should return an empty list on an empty pen', async () => {
    mkdirSync(join(ROOT, '.canon', 'memory'), { recursive: true })

    const report = await readPen()

    expect(report.entries).toEqual([])
    expect(report.due).toBe(0)
  })

  it('should refuse with no-folder when the pen does not exist', async () => {
    const outcome = await staleMemory(ROOT, 30, NOW)

    expect(outcome).toMatchObject({ ok: false, reason: 'no-folder' })
  })

  it('should read a pen at the legacy .claude root', async () => {
    writeEntry('project-legacy', { root: '.claude' })

    const report = await readPen()

    expect(names(report.entries)).toEqual(['project-legacy'])
  })
})

describe('citedPaths', () => {
  it('should skip a backticked token carrying no slash or no extension', () => {
    expect(citedPaths('`README.md` `src/records` `bun run check`')).toEqual([])
  })

  it('should skip a URL, an absolute path, a home path, and a variable', () => {
    expect(
      citedPaths(
        '`https://example.com/a.md` `/tmp/x/a.md` `~/.claude/a.md` `$ROOT/a.md`',
      ),
    ).toEqual([])
  })

  it('should skip a path climbing out of the root', () => {
    expect(citedPaths('`../other/a.md`')).toEqual([])
  })

  it('should skip a path elided with an ellipsis', () => {
    expect(citedPaths('`@/home/me/.../body.md` `src/.../a.ts`')).toEqual([])
  })
})
