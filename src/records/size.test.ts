import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type FolderSize,
  formatBytes,
  GROWTH_WINDOWS,
  sizedFolders,
  type SizeReport,
  sizeRecords,
} from '@/records/size'

let ROOT: string

/**
 * Pinned so a window count is read against fixture timestamps rather than the
 * clock, and parsed without an offset so it lands at local noon.
 *
 * The dated assertions below name a calendar date, which the report renders in
 * local time. A UTC instant would shift that date on any machine far enough east
 * or west, so the fixture is what keeps those expectations machine-independent
 * rather than the renderer. Noon leaves an hour of DST movement in either
 * direction without reaching a day boundary.
 */
const NOW = Date.parse('2026-08-20T12:00:00')
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Paths `stat` answers as absent, which is the one state a fixture cannot reach
 * by deleting a file. A file removed before the walk is never listed, so the
 * gap between the listing and the read is injected rather than staged.
 */
const { VANISHED } = vi.hoisted(() => ({ VANISHED: new Set<string>() }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    stat: async (path: string) => {
      if (!VANISHED.has(path)) return actual.stat(path)

      const error: NodeJS.ErrnoException = new Error(`ENOENT: ${path}`)
      error.code = 'ENOENT'
      throw error
    },
  }
})

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-size-'))
  mkdirSync(join(ROOT, '.claude'), { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  VANISHED.clear()
})

function writeRecordAt(relative: string, body: string, stamp: Date): void {
  const path = join(ROOT, '.claude', relative)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
  utimesSync(path, stamp, stamp)
}

function writeRecord(relative: string, body: string, daysAgo: number): void {
  writeRecordAt(relative, body, new Date(NOW - daysAgo * DAY_MS))
}

async function read(): Promise<SizeReport> {
  const outcome = await sizeRecords(ROOT, NOW)
  if (!outcome.ok) throw new Error(`refused: ${outcome.reason}`)
  return outcome
}

function folder(report: SizeReport, name: string): FolderSize {
  const found = report.folders.find((entry) => entry.folder === name)
  if (!found) throw new Error(`no folder in the report: ${name}`)
  return found
}

function touchedWithin(entry: FolderSize, days: number): number {
  return entry.touched.find((window) => window.days === days)?.files ?? 0
}

describe('sizeRecords', () => {
  it('should refuse when the project holds neither record root', async () => {
    const bare = join(ROOT, 'nested')
    mkdirSync(bare, { recursive: true })

    const outcome = await sizeRecords(bare, NOW)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('no-folder')
  })

  it('should read a project holding the new root alone', async () => {
    const migrated = join(ROOT, 'migrated')
    const path = join(migrated, '.canon', 'memory', 'project-one.md')
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '12345')

    const outcome = await sizeRecords(migrated, NOW)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(folder(outcome, 'memory')).toMatchObject({ present: true, files: 1 })
  })

  it('should read the scratch folder at the name the new root gives it', async () => {
    const migrated = join(ROOT, 'migrated-scratch')
    const path = join(migrated, '.canon', 'tmp', 'routing', 'one.md')
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '12345')

    const outcome = await sizeRecords(migrated, NOW)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(folder(outcome, '.tmp')).toMatchObject({ present: true, files: 1 })
  })

  it('should skip a file that leaves between the listing and the read', async () => {
    writeRecord('memory/project-one.md', '12345', 1)
    writeRecord('memory/project-gone.md', '123', 1)
    VANISHED.add(join(ROOT, '.claude', 'memory', 'project-gone.md'))

    const entry = folder(await read(), 'memory')

    expect(entry.files).toBe(1)
    expect(entry.bytes).toBe(5)
  })

  it('should report every sized folder whether or not it exists', async () => {
    const report = await read()

    expect(report.folders.map((entry) => entry.folder)).toEqual(
      sizedFolders(ROOT),
    )
  })

  it('should report an absent folder as absent rather than as empty', async () => {
    const report = await read()

    expect(folder(report, 'memory').present).toBe(false)
    expect(folder(report, 'memory').files).toBe(0)
  })

  it('should count the files a folder holds and the bytes they occupy', async () => {
    writeRecord('memory/project-one.md', '12345', 1)
    writeRecord('memory/project-two.md', '123', 1)

    const report = await read()

    expect(folder(report, 'memory').files).toBe(2)
    expect(folder(report, 'memory').bytes).toBe(8)
  })

  it('should count a file nested below the folder root', async () => {
    writeRecord('groundwork/a-track/06-decision.md', 'body', 1)

    expect(folder(await read(), 'groundwork').files).toBe(1)
  })

  it('should total the files and bytes across every folder', async () => {
    writeRecord('memory/project-one.md', '12345', 1)
    writeRecord('review/review-one.md', '123', 1)

    const report = await read()

    expect(report.files).toBe(2)
    expect(report.bytes).toBe(8)
  })

  it('should count a file inside a growth window and leave out one past it', async () => {
    writeRecord('memory/project-recent.md', 'body', 2)
    writeRecord('memory/project-older.md', 'body', 20)
    writeRecord('memory/project-ancient.md', 'body', 200)

    const entry = folder(await read(), 'memory')

    expect(touchedWithin(entry, 7)).toBe(1)
    expect(touchedWithin(entry, 30)).toBe(2)
  })

  it('should report a window for each published window length', async () => {
    writeRecord('memory/project-one.md', 'body', 1)

    expect(
      folder(await read(), 'memory').touched.map((window) => window.days),
    ).toEqual([...GROWTH_WINDOWS])
  })

  it('should date the least and most recently written file in the folder', async () => {
    writeRecord('memory/project-recent.md', 'body', 1)
    writeRecord('memory/project-older.md', 'body', 40)

    const entry = folder(await read(), 'memory')

    expect(entry.oldest).toBe('2026-07-11')
    expect(entry.newest).toBe('2026-08-19')
  })

  // The two cases below cover the two signs of a UTC offset, and each one is
  // blind to the other's half. A machine west of Greenwich rolls a late-evening
  // stamp forward into the next UTC day, and one east of it rolls an
  // early-morning stamp back into the previous one. A single case therefore
  // passes on half the world while the bug is present, and a machine sitting on
  // UTC catches neither, which is where CI runs.

  it('should date a late-evening file by the local day its writer saw', async () => {
    writeRecordAt(
      'memory/project-late.md',
      'body',
      new Date(2026, 7, 18, 23, 30),
    )

    expect(folder(await read(), 'memory').newest).toBe('2026-08-18')
  })

  it('should date an early-morning file by the local day its writer saw', async () => {
    writeRecordAt(
      'memory/project-early.md',
      'body',
      new Date(2026, 7, 18, 0, 30),
    )

    expect(folder(await read(), 'memory').newest).toBe('2026-08-18')
  })

  it('should leave an absent folder undated', async () => {
    const entry = folder(await read(), 'memory')

    expect(entry.oldest).toBeUndefined()
    expect(entry.newest).toBeUndefined()
  })

  it('should read the scratch folder a backup skips', async () => {
    writeRecord('.tmp/memory-routing/pen.md', 'body', 1)

    expect(folder(await read(), '.tmp').files).toBe(1)
  })
})

describe('formatBytes', () => {
  it('should render a small count in bytes', () => {
    expect(formatBytes(512)).toBe('512B')
  })

  it('should render a kilobyte count with one decimal below ten', () => {
    expect(formatBytes(1536)).toBe('1.5K')
  })

  it('should round a kilobyte count at ten and above', () => {
    expect(formatBytes(1024 * 12)).toBe('12K')
  })

  it('should climb to the largest unit the count reaches', () => {
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0M')
  })
})
