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
  applyScratchEvidence,
  planScratchEvidence,
  PROMOTED_FOLDERS,
  readScratchEvidenceCorpus,
  sourcePath,
  walkScratchEvidenceCorpus,
} from '@/migrate/scratch-evidence'

let root: string

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
  const files = await walkScratchEvidenceCorpus(at)
  const sources = await readScratchEvidenceCorpus(files)
  return planScratchEvidence(at, sources)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-scratch-evidence-'))
  mkdirSync(join(root, '.canon'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), '.canon\n')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('planScratchEvidence', () => {
  it('should plan a numbered folder move for a promoted folder found on disk', async () => {
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')

    const plan = await planFrom(root)

    expect(plan.moves).toEqual([
      {
        folder: 'system-map',
        from: sourcePath(root, 'system-map'),
        to: join(root, '.canon/evidence/01-system-map'),
      },
    ])
  })

  it('should number promoted folders by first appearance, continuing past an existing ordinal', async () => {
    write('.canon/evidence/02-older-trail/notes.md', 'x')
    writeAt(
      '.canon/tmp/system-map/how-it-works.md',
      'the map\n',
      new Date('2026-08-03T15:00:00Z'),
    )
    writeAt(
      '.canon/tmp/target-survey/survey.md',
      'the survey\n',
      new Date('2026-08-03T09:00:00Z'),
    )

    const plan = await planFrom(root)

    expect(plan.moves.map((move) => move.to)).toEqual([
      join(root, '.canon/evidence/03-target-survey'),
      join(root, '.canon/evidence/04-system-map'),
    ])
  })

  it('should rewrite a citation sitting inside a pruned archive', async () => {
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')
    write(
      '.canon/tasks/archive/v1.0-shipped.md',
      'See `.claude/.tmp/system-map/how-it-works.md` for the orientation.\n',
    )

    const plan = await planFrom(root)
    const entry = plan.entries.find((candidate) =>
      candidate.path.endsWith('v1.0-shipped.md'),
    )

    expect(entry?.rewritten).toBe(1)
    expect(entry?.text).toContain('.canon/evidence/01-system-map')
    expect(entry?.text).not.toContain('.claude/.tmp/system-map')
  })

  it('should rewrite a citation reached under groundwork', async () => {
    write('.canon/tmp/target-survey/survey.md', 'the survey\n')
    write(
      '.canon/groundwork/01-trail/notes.md',
      'Counts are in `.claude/.tmp/target-survey/survey.md`.\n',
    )

    const plan = await planFrom(root)
    const entry = plan.entries.find((candidate) =>
      candidate.path.includes('groundwork'),
    )

    expect(entry?.text).toContain('.canon/evidence/01-target-survey')
  })

  it('should leave a citation carrying the keep marker on its own line unchanged', async () => {
    const text =
      'No target holds a `.claude/.tmp/system-map/` folder to move. <!-- canon-keep-record-root -->\n'
    write('.canon/plans/feature-example.md', text)
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')

    const plan = await planFrom(root)

    expect(plan.entries).toHaveLength(0)
    expect(
      readFileSync(join(root, '.canon/plans/feature-example.md'), 'utf8'),
    ).toBe(text)
  })

  it('should leave a citation unchanged when the marker sits on the nearest non-blank line above it', async () => {
    const text =
      '<!-- canon-keep-record-root -->\nNo target holds a `.claude/.tmp/system-map/` folder to move.\n'
    write('.canon/plans/feature-example.md', text)
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')

    const plan = await planFrom(root)

    expect(plan.entries).toHaveLength(0)
  })

  it('should leave a citation naming a folder outside the promotion map byte-identical', async () => {
    const text =
      'Evidence sits at `.claude/.tmp/eval-runs/run-01.md`, still on disk.\n'
    write('.canon/tasks/archive/v1.0-shipped.md', text)

    const plan = await planFrom(root)

    expect(plan.entries).toHaveLength(0)
    expect(
      readFileSync(join(root, '.canon/tasks/archive/v1.0-shipped.md'), 'utf8'),
    ).toBe(text)
  })

  it('should refuse a folder move whose slug evidence already holds', async () => {
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')
    write('.canon/evidence/01-system-map/how-it-works.md', 'already there\n')

    const plan = await planFrom(root)

    expect(plan.moves).toHaveLength(0)
    expect(plan.collisions).toEqual([
      join(root, '.canon/evidence/01-system-map'),
    ])
  })

  it('should leave a refused folder citation untouched while a moving folder citation rewrites', async () => {
    const collidedText =
      'See `.claude/.tmp/system-map/how-it-works.md` for the orientation.\n'
    const movedText = 'Counts are in `.claude/.tmp/target-survey/survey.md`.\n'

    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')
    write('.canon/evidence/01-system-map/how-it-works.md', 'already there\n')
    write('.canon/tmp/target-survey/survey.md', 'the survey\n')
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
    expect(movedEntry?.text).toContain('.canon/evidence/02-target-survey')
  })

  it('should still rewrite a late citation of a folder that already completed its move', async () => {
    write('.canon/evidence/03-system-map/how-it-works.md', 'already moved\n')
    write(
      '.canon/tasks/archive/late.md',
      'See `.claude/.tmp/system-map/how-it-works.md`.\n',
    )

    const plan = await planFrom(root)

    expect(plan.moves).toHaveLength(0)
    expect(plan.collisions).toHaveLength(0)

    const entry = plan.entries.find((candidate) =>
      candidate.path.endsWith('late.md'),
    )
    expect(entry?.text).toContain('.canon/evidence/03-system-map')
  })
})

describe('applyScratchEvidence', () => {
  it('should move the folder and rewrite the citation, then rewrite zero on a second run', async () => {
    write('.canon/tmp/system-map/how-it-works.md', 'the map\n')
    write(
      '.canon/tasks/archive/v1.0-shipped.md',
      'See `.claude/.tmp/system-map/how-it-works.md`.\n',
    )

    const first = await planFrom(root)
    const result = await applyScratchEvidence(first)

    expect(result.moved).toBe(1)
    expect(result.written).toBe(1)
    expect(result.failed).toEqual([])
    expect(existsSync(join(root, '.canon/tmp/system-map'))).toBe(false)
    expect(
      existsSync(join(root, '.canon/evidence/01-system-map/how-it-works.md')),
    ).toBe(true)

    const second = await planFrom(root)
    expect(second.moves).toHaveLength(0)
    expect(second.rewritten).toBe(0)
  })
})

describe('PROMOTED_FOLDERS', () => {
  it('should carry nine folders', () => {
    expect(PROMOTED_FOLDERS).toHaveLength(9)
  })
})
