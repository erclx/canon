import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type PruneReport, pruneScratch } from '@/records/prune'

let ROOT: string

/** Pinned so an age comparison reads against a fixture timestamp rather than the clock. */
const NOW = Date.parse('2026-09-15T12:00:00')
const DAY_MS = 24 * 60 * 60 * 1000
const OLDER_THAN = 14

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-prune-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function writeAt(scratchRel: string, relative: string, daysAgo: number): void {
  const path = join(ROOT, scratchRel, relative)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, 'x')
  const stamp = new Date(NOW - daysAgo * DAY_MS)
  utimesSync(path, stamp, stamp)
}

function makeEmptyDir(scratchRel: string, relative: string): void {
  mkdirSync(join(ROOT, scratchRel, relative), { recursive: true })
}

async function read(
  write = false,
  olderThan = OLDER_THAN,
): Promise<PruneReport> {
  const outcome = await pruneScratch(ROOT, olderThan, write, NOW)
  if (!outcome.ok) throw new Error(`refused: ${outcome.reason}`)
  return outcome
}

function paths(report: PruneReport): string[] {
  return report.candidates.map((unit) => unit.path)
}

describe('pruneScratch at a .canon root', () => {
  beforeEach(() => {
    mkdirSync(join(ROOT, '.canon'), { recursive: true })
  })

  it('should offer a slug whose newest file is past the threshold', async () => {
    writeAt('.canon/tmp', 'old-spike/note.md', 20)

    const report = await read()

    expect(paths(report)).toContain('.canon/tmp/old-spike')
  })

  it('should keep a slug whose newest file is inside the threshold', async () => {
    writeAt('.canon/tmp', 'fresh-spike/note.md', 2)

    const report = await read()

    expect(paths(report)).not.toContain('.canon/tmp/fresh-spike')
    expect(report.kept.map((unit) => unit.path)).toContain(
      '.canon/tmp/fresh-spike',
    )
  })

  it('should offer an empty folder regardless of age', async () => {
    makeEmptyDir('.canon/tmp', 'empty-slug')

    const report = await read()

    expect(paths(report)).toContain('.canon/tmp/empty-slug')
  })

  it('should never offer tmp/handoff/ or tmp/pr/poll/, whatever their age', async () => {
    writeAt('.canon/tmp', 'handoff/some-routing/note.md', 90)
    writeAt('.canon/tmp', 'pr/poll/baseline.json', 90)

    const report = await read()

    expect(
      paths(report).some((path) => path.startsWith('.canon/tmp/handoff')),
    ).toBe(false)
    expect(
      paths(report).some((path) => path.startsWith('.canon/tmp/pr/poll')),
    ).toBe(false)
    const skippedPaths = report.skipped.map((entry) => entry.path)
    expect(skippedPaths).toContain('.canon/tmp/handoff')
    expect(skippedPaths).toContain('.canon/tmp/pr/poll')
  })

  it('should skip a scratch-root name a different migration moves out, such as memory-archive', async () => {
    writeAt('.canon/tmp', 'memory-archive/2026-08-01-retired.md', 90)

    const report = await read()

    expect(paths(report)).not.toContain('.canon/tmp/memory-archive')
    const skipped = report.skipped.find(
      (entry) => entry.path === '.canon/tmp/memory-archive',
    )
    expect(skipped?.reason).toContain('canon migrate record-layout')
  })

  it('should skip the pre-split handoff and poll names at the scratch root instead of offering them as slugs', async () => {
    writeAt('.canon/tmp', 'memory-routing/note.md', 90)
    writeAt('.canon/tmp', 'teach-promotion/note.md', 90)
    writeAt('.canon/tmp', 'ui-checklist/note.md', 90)
    writeAt('.canon/tmp', 'pr-poll/baseline.json', 90)

    const report = await read()

    for (const legacy of [
      'memory-routing',
      'teach-promotion',
      'ui-checklist',
      'pr-poll',
    ]) {
      expect(paths(report)).not.toContain(`.canon/tmp/${legacy}`)
      const skipped = report.skipped.find(
        (entry) => entry.path === `.canon/tmp/${legacy}`,
      )
      expect(skipped).toBeDefined()
    }
  })

  it('should prune a hook marker file individually', async () => {
    writeAt('.canon/tmp', 'hooks/scratch-guard/session-abc123', 30)
    writeAt('.canon/tmp', 'hooks/scratch-guard/session-fresh', 1)

    const report = await read()

    expect(paths(report)).toContain(
      '.canon/tmp/hooks/scratch-guard/session-abc123',
    )
    expect(paths(report)).not.toContain(
      '.canon/tmp/hooks/scratch-guard/session-fresh',
    )
  })

  it('should offer a folder one level inside runs/ as a whole unit', async () => {
    writeAt('.canon/tmp', 'runs/eval/2026-08-01/ledger.md', 40)

    const report = await read()

    expect(paths(report)).toContain('.canon/tmp/runs/eval')
  })

  it('should delete with --write exactly what the dry run listed', async () => {
    writeAt('.canon/tmp', 'old-spike/note.md', 20)
    writeAt('.canon/tmp', 'fresh-spike/note.md', 2)

    const dry = await read(false)
    expect(paths(dry)).toEqual(['.canon/tmp/old-spike'])
    expect(existsSync(join(ROOT, '.canon/tmp/old-spike'))).toBe(true)

    const written = await read(true)

    expect(written.deleted).toEqual(['.canon/tmp/old-spike'])
    expect(existsSync(join(ROOT, '.canon/tmp/old-spike'))).toBe(false)
    expect(existsSync(join(ROOT, '.canon/tmp/fresh-spike'))).toBe(true)
  })
})

describe('pruneScratch at a legacy .claude root', () => {
  beforeEach(() => {
    mkdirSync(join(ROOT, '.claude'), { recursive: true })
  })

  it('should resolve .claude/.tmp/ when no .canon root exists', async () => {
    writeAt('.claude/.tmp', 'old-spike/note.md', 20)

    const report = await read()

    expect(paths(report)).toContain('.claude/.tmp/old-spike')
  })
})
