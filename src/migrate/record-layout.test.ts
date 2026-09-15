import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyRecordLayout,
  destinationPath,
  planRecordLayout,
  RECORD_LAYOUT_MOVES,
  readRecordLayoutCorpus,
  sourcePath,
  strayReceipts,
  walkRecordLayoutCorpus,
} from '@/migrate/record-layout'

let root: string

const REVIEW_MOVE = RECORD_LAYOUT_MOVES[0]!
const ARCHIVE_MOVE = RECORD_LAYOUT_MOVES[1]!

function write(relative: string, text: string): void {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

async function planFrom(at: string) {
  const files = await walkRecordLayoutCorpus(at)
  const sources = await readRecordLayoutCorpus(files)
  return planRecordLayout(at, sources)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-record-layout-'))
  mkdirSync(join(root, '.canon'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), '.canon\n')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('planRecordLayout', () => {
  it('should plan a folder move for review receipts found on disk', async () => {
    write('.canon/review/memory/review-example.md', 'a receipt\n')

    const plan = await planFrom(root)

    expect(plan.moves).toContainEqual({
      move: REVIEW_MOVE,
      from: sourcePath(root, REVIEW_MOVE),
      to: destinationPath(root, REVIEW_MOVE),
    })
  })

  it('should plan a folder move for the retired-entry archive found on disk', async () => {
    write('.canon/tmp/memory-archive/retired-example.md', 'a retirement\n')

    const plan = await planFrom(root)

    expect(plan.moves).toContainEqual({
      move: ARCHIVE_MOVE,
      from: sourcePath(root, ARCHIVE_MOVE),
      to: destinationPath(root, ARCHIVE_MOVE),
    })
  })

  it('should rewrite a receipt citation reached under tasks/archive/', async () => {
    write('.canon/review/memory/review-example.md', 'a receipt\n')
    write(
      '.canon/tasks/archive/v1.0-shipped.md',
      'Receipt at `.canon/review/memory/review-example.md`.\n',
    )

    const plan = await planFrom(root)
    const entry = plan.entries.find((candidate) =>
      candidate.path.endsWith('v1.0-shipped.md'),
    )

    expect(entry?.rewritten).toBe(1)
    expect(entry?.text).toContain('.canon/memory/review/')
    expect(entry?.text).not.toContain('.canon/review/memory/')
  })

  it('should rewrite an archive citation reached under plans/archive/', async () => {
    write('.canon/tmp/memory-archive/retired-example.md', 'a retirement\n')
    write(
      '.canon/plans/archive/feature-shipped.md',
      'Retired at `.canon/tmp/memory-archive/retired-example.md`.\n',
    )

    const plan = await planFrom(root)
    const entry = plan.entries.find((candidate) =>
      candidate.path.endsWith('feature-shipped.md'),
    )

    expect(entry?.rewritten).toBe(1)
    expect(entry?.text).toContain('.canon/memory/archive/')
    expect(entry?.text).not.toContain('.canon/tmp/memory-archive/')
  })

  it('should leave a citation carrying the keep marker unchanged', async () => {
    const text =
      'No target holds a `.canon/review/memory/` folder to move. <!-- canon-keep-record-root -->\n'
    write('.canon/plans/feature-example.md', text)
    write('.canon/review/memory/review-example.md', 'a receipt\n')

    const plan = await planFrom(root)

    expect(plan.entries).toHaveLength(0)
    expect(
      readFileSync(join(root, '.canon/plans/feature-example.md'), 'utf8'),
    ).toBe(text)
  })

  it('should refuse a folder move whose destination already exists', async () => {
    write('.canon/review/memory/review-example.md', 'a receipt\n')
    write('.canon/memory/review/review-example.md', 'already there\n')

    const plan = await planFrom(root)

    expect(plan.moves).toHaveLength(0)
    expect(plan.collisions).toEqual([destinationPath(root, REVIEW_MOVE)])
  })

  it('should leave a refused move citation untouched while a moving one rewrites', async () => {
    const collidedText =
      'Receipt at `.canon/review/memory/review-example.md`.\n'
    const movedText =
      'Retired at `.canon/tmp/memory-archive/retired-example.md`.\n'

    write('.canon/review/memory/review-example.md', 'a receipt\n')
    write('.canon/memory/review/review-example.md', 'already there\n')
    write('.canon/tmp/memory-archive/retired-example.md', 'a retirement\n')
    write('.canon/tasks/archive/collided.md', collidedText)
    write('.canon/tasks/archive/moved.md', movedText)

    const plan = await planFrom(root)

    const collidedEntry = plan.entries.find((candidate) =>
      candidate.path.endsWith('collided.md'),
    )
    const movedEntry = plan.entries.find((candidate) =>
      candidate.path.endsWith('moved.md'),
    )

    expect(collidedEntry).toBeUndefined()
    expect(movedEntry?.text).toContain('.canon/memory/archive/')
  })
})

describe('applyRecordLayout', () => {
  it('should move both folders and rewrite citations, then act as a no-op on a second run', async () => {
    write('.canon/review/memory/review-example.md', 'a receipt\n')
    write('.canon/tmp/memory-archive/retired-example.md', 'a retirement\n')
    write(
      '.canon/tasks/archive/v1.0-shipped.md',
      [
        'Receipt at `.canon/review/memory/review-example.md`.',
        'Retired at `.canon/tmp/memory-archive/retired-example.md`.',
        '',
      ].join('\n'),
    )

    const first = await planFrom(root)
    const result = await applyRecordLayout(first)

    expect(result.moved).toBe(2)
    expect(result.written).toBe(1)
    expect(result.failed).toEqual([])
    expect(existsSync(join(root, '.canon/review/memory'))).toBe(false)
    expect(existsSync(join(root, '.canon/tmp/memory-archive'))).toBe(false)
    expect(
      existsSync(join(root, '.canon/memory/review/review-example.md')),
    ).toBe(true)
    expect(
      existsSync(join(root, '.canon/memory/archive/retired-example.md')),
    ).toBe(true)

    const second = await planFrom(root)
    expect(second.moves).toHaveLength(0)
    expect(second.rewritten).toBe(0)
  })

  it('should rewrite a citation carried inside a folder the same run moves', async () => {
    write('.canon/review/memory/review-example.md', 'a receipt\n')
    write('.canon/tmp/memory-archive/retired-example.md', 'a retirement\n')
    write(
      '.canon/review/memory/archive/old-receipt.md',
      'Retired at `.canon/tmp/memory-archive/retired-example.md`.\n',
    )

    const plan = await planFrom(root)
    const result = await applyRecordLayout(plan)

    expect(result.failed).toEqual([])
    expect(result.moved).toBe(2)
    expect(result.written).toBe(1)
    expect(
      readFileSync(
        join(root, '.canon/memory/review/archive/old-receipt.md'),
        'utf8',
      ),
    ).toContain('.canon/memory/archive/')
  })
})

describe('strayReceipts', () => {
  it('should report a receipt at the flat review/ root rather than moving it', async () => {
    write('.canon/review/memory-review-question-surface-default.md', 'stray\n')
    write('.canon/review/memory/review-example.md', 'a receipt\n')

    expect(strayReceipts(root)).toEqual([
      join(root, '.canon/review/memory-review-question-surface-default.md'),
    ])

    const plan = await planFrom(root)
    expect(plan.strays).toEqual([
      join(root, '.canon/review/memory-review-question-surface-default.md'),
    ])
  })
})

describe('RECORD_LAYOUT_MOVES', () => {
  it('should carry one entry per move, data-shaped for a later batch to append', () => {
    expect(RECORD_LAYOUT_MOVES).toEqual([
      { from: ['review', 'memory'], to: ['memory', 'review'] },
      { from: ['.tmp', 'memory-archive'], to: ['memory', 'archive'] },
    ])
  })
})
