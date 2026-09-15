import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyRecordLayout,
  destinationPath,
  type FolderLayoutMove,
  planRecordLayout,
  RECORD_LAYOUT_MOVES,
  readRecordLayoutCorpus,
  sourcePath,
  strayReceipts,
  walkRecordLayoutCorpus,
} from '@/migrate/record-layout'

let root: string

const REVIEW_MOVE = RECORD_LAYOUT_MOVES[0] as FolderLayoutMove
const ARCHIVE_MOVE = RECORD_LAYOUT_MOVES[1] as FolderLayoutMove

function write(relative: string, text: string): void {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function writeAt(relative: string, text: string, at: Date): void {
  write(relative, text)
  utimesSync(join(root, relative), at, at)
}

async function planFrom(at: string) {
  const files = await walkRecordLayoutCorpus(at)
  const sources = await readRecordLayoutCorpus(files)
  return planRecordLayout(at, sources)
}

function movesTo(plan: Awaited<ReturnType<typeof planFrom>>) {
  return plan.moves.map((move) => ({
    from: move.from.slice(root.length + 1),
    to: move.to.slice(root.length + 1),
    classified: move.classified,
  }))
}

function entryFor(
  plan: Awaited<ReturnType<typeof planFrom>>,
  suffix: string,
): string | undefined {
  return plan.entries.find((candidate) => candidate.path.endsWith(suffix))?.text
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

  it('should move feedback to its own root folder and rewrite its citation', async () => {
    write('.canon/review/feedback/feedback-a-1.md', 'a report\n')
    write(
      '.canon/tasks/v1.0-open.md',
      'Filed at `.canon/review/feedback/feedback-a-1.md`.\n',
    )

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/feedback',
      to: '.canon/feedback',
      classified: undefined,
    })
    expect(entryFor(plan, 'v1.0-open.md')).toContain(
      '`.canon/feedback/feedback-a-1.md`',
    )
  })

  it('should move a render folder under tmp/render and rewrite its citation', async () => {
    write('.canon/review/board/index.html', '<h1>board</h1>\n')
    write(
      '.canon/plans/feature-look.md',
      'Open `.canon/review/board/index.html`.\n',
    )

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/board',
      to: '.canon/tmp/render/board',
      classified: undefined,
    })
    expect(entryFor(plan, 'feature-look.md')).toContain(
      '`.canon/tmp/render/board/index.html`',
    )
  })

  it('should skip a render move whose source is absent', async () => {
    write('.canon/review/board/index.html', '<h1>board</h1>\n')

    const plan = await planFrom(root)

    expect(
      movesTo(plan).some((move) => move.from === '.canon/review/design'),
    ).toBe(false)
  })

  it('should move reference images beside the picks they fed', async () => {
    write('.canon/review/references/nav.png', 'x')

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/references',
      to: '.canon/picks/references',
      classified: undefined,
    })
  })

  it('should flatten a branch report beside the audits and rewrite its citation', async () => {
    write('.canon/review/branch/review-user-batch.md', 'a report\n')
    write(
      '.canon/tasks/v1.0-open.md',
      'Findings in `.canon/review/branch/review-user-batch.md`.\n',
    )

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/branch/review-user-batch.md',
      to: '.canon/review/branch-user-batch.md',
      classified: undefined,
    })
    expect(entryFor(plan, 'v1.0-open.md')).toContain(
      '`.canon/review/branch-user-batch.md`',
    )
  })

  it('should move a flat checklist into the tmp handoff folder and rewrite its citation', async () => {
    write('.canon/review/ui-checklist-task-filter.md', '- [ ] look\n')
    write(
      '.canon/tasks/v1.0-open.md',
      'Checklist at `.canon/review/ui-checklist-task-filter.md`.\n',
    )

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/ui-checklist-task-filter.md',
      to: '.canon/tmp/ui-checklist/task-filter.md',
      classified: undefined,
    })
    expect(entryFor(plan, 'v1.0-open.md')).toContain(
      '`.canon/tmp/ui-checklist/task-filter.md`',
    )
  })

  it('should classify a folder holding an arm capture as a pick', async () => {
    write('.canon/review/evidence/header-look/arm-0.png', 'x')
    write('.canon/review/evidence/header-look/arm-0.stamp', 'x')

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/evidence/header-look',
      to: '.canon/picks/header-look',
      classified: 'pick',
    })
  })

  it('should classify a folder holding a design handoff as a pick', async () => {
    write('.canon/review/evidence/brand-refs/design-handoff.md', 'handoff\n')

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/evidence/brand-refs',
      to: '.canon/picks/brand-refs',
      classified: 'pick',
    })
  })

  it('should number evidence folders by their oldest file, breaking a same-day tie on the full timestamp', async () => {
    writeAt(
      '.canon/review/evidence/later-notes/notes.md',
      'x',
      new Date('2026-08-03T15:00:00Z'),
    )
    writeAt(
      '.canon/review/evidence/earlier-notes/notes.md',
      'x',
      new Date('2026-08-03T09:00:00Z'),
    )
    writeAt(
      '.canon/review/evidence/earlier-notes/newer.md',
      'x',
      new Date('2026-09-01T09:00:00Z'),
    )

    const plan = await planFrom(root)

    expect(movesTo(plan)).toEqual(
      expect.arrayContaining([
        {
          from: '.canon/review/evidence/earlier-notes',
          to: '.canon/evidence/01-earlier-notes',
          classified: 'evidence',
        },
        {
          from: '.canon/review/evidence/later-notes',
          to: '.canon/evidence/02-later-notes',
          classified: 'evidence',
        },
      ]),
    )
  })

  it('should continue numbering past an evidence folder already numbered', async () => {
    write('.canon/evidence/03-old-survey/survey.md', 'x')
    write('.canon/review/evidence/new-survey/survey.md', 'x')

    const plan = await planFrom(root)

    expect(movesTo(plan)).toContainEqual({
      from: '.canon/review/evidence/new-survey',
      to: '.canon/evidence/04-new-survey',
      classified: 'evidence',
    })
  })

  it('should refuse an evidence folder whose slug is already numbered', async () => {
    write('.canon/evidence/01-survey/survey.md', 'x')
    write('.canon/review/evidence/survey/survey.md', 'x')

    const plan = await planFrom(root)

    expect(movesTo(plan)).toHaveLength(0)
    expect(plan.collisions).toEqual([join(root, '.canon/evidence/01-survey')])
  })

  it('should rewrite a pick and an evidence citation to their derived destinations', async () => {
    write('.canon/review/evidence/header-look/arm-0.png', 'x')
    write('.canon/review/evidence/survey/survey.md', 'x')
    write(
      '.canon/tasks/archive/v1.0-shipped.md',
      [
        'Arms at `.canon/review/evidence/header-look/arm-0.png`.',
        'Counts in `.canon/review/evidence/survey/survey.md`.',
        'A sibling `.canon/review/evidence/survey-two/` is not this one.',
        '',
      ].join('\n'),
    )

    const plan = await planFrom(root)
    const text = entryFor(plan, 'v1.0-shipped.md')

    expect(text).toContain('`.canon/picks/header-look/arm-0.png`')
    expect(text).toContain('`.canon/evidence/01-survey/survey.md`')
    expect(text).toContain('`.canon/review/evidence/survey-two/`')
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

  it('should remove the branch folder once its last report moves out', async () => {
    write('.canon/review/branch/review-user-batch.md', 'a report\n')

    const plan = await planFrom(root)
    const result = await applyRecordLayout(plan)

    expect(result.failed).toEqual([])
    expect(existsSync(join(root, '.canon/review/branch-user-batch.md'))).toBe(
      true,
    )
    expect(existsSync(join(root, '.canon/review/branch'))).toBe(false)
  })

  it('should rewrite a citation inside an evidence folder before numbering moves it', async () => {
    write('.canon/review/evidence/survey/survey.md', 'x')
    write(
      '.canon/review/evidence/survey/notes.md',
      'See `.canon/review/feedback/feedback-a-1.md`.\n',
    )
    write('.canon/review/feedback/feedback-a-1.md', 'a report\n')

    const plan = await planFrom(root)
    const result = await applyRecordLayout(plan)

    expect(result.failed).toEqual([])
    expect(
      readFileSync(join(root, '.canon/evidence/01-survey/notes.md'), 'utf8'),
    ).toContain('`.canon/feedback/feedback-a-1.md`')
    expect(existsSync(join(root, '.canon/review/evidence/survey'))).toBe(false)
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
  it('should keep batch 2 as its first two rows, data-shaped for a later batch to append', () => {
    expect(RECORD_LAYOUT_MOVES.slice(0, 2)).toEqual([
      { kind: 'folder', from: ['review', 'memory'], to: ['memory', 'review'] },
      {
        kind: 'folder',
        from: ['.tmp', 'memory-archive'],
        to: ['memory', 'archive'],
      },
    ])
  })
})
