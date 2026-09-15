import {
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
  applyRecordTree,
  LIVE_FOLDERS,
  OBJECT_STORE,
  planRecordTree,
  readRecordTree,
  walkRecordTree,
} from '@/migrate/record-tree'

let root: string

/** A citation of the class the sweep exists to repoint. */
const LIVE_CITATION = 'Plan: .claude/plans/feature-x.md\n'

function write(relative: string, text: string): void {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

/**
 * A record tree carrying one file of each class the scope has to separate.
 *
 * Every file spells the same citation, so a file's outcome is attributable to
 * where it sits rather than to what it says.
 */
function seed(): void {
  write('.canon/tasks/v1.1-row.md', LIVE_CITATION)
  write('.canon/memory/entry.md', LIVE_CITATION)
  write('.canon/plans/archive/feature-shipped.md', LIVE_CITATION)
  write('.canon/memory/review/archive/receipt.md', LIVE_CITATION)
  write('.canon/groundwork/01-trail/notes.md', LIVE_CITATION)
  write('.canon/intake/01-dump/item.md', LIVE_CITATION)
  write('.canon/tmp/scratch/note.md', LIVE_CITATION)
  write(`.canon/${OBJECT_STORE}/objects/ab/012345`, LIVE_CITATION)
  write('.canon/README.md', LIVE_CITATION)
  write('.claude/tasks/v1.1-row.md', LIVE_CITATION)
}

async function planFrom(at: string) {
  const walk = await walkRecordTree(at)
  const sources = await readRecordTree(at, walk.files)
  return planRecordTree(sources, walk.excluded, walk.skipped)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-record-tree-'))
  seed()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('LIVE_FOLDERS', () => {
  it('should leave every closed trail and scratch out of the scope', () => {
    for (const excluded of ['groundwork', 'intake', 'tmp', OBJECT_STORE]) {
      expect(LIVE_FOLDERS).not.toContain(excluded)
    }
  })
})

describe('walkRecordTree', () => {
  it('should sweep a file in a live folder', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.files).toContain('.canon/tasks/v1.1-row.md')
    expect(walk.files).toContain('.canon/memory/entry.md')
  })

  it('should leave an archive subtree of a live folder unswept', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.files).not.toContain('.canon/plans/archive/feature-shipped.md')
    expect(walk.excluded).toContainEqual({
      path: '.canon/plans/archive',
      files: 1,
    })
  })

  it('should prune an archive nested below the top of a live folder', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.files).not.toContain('.canon/memory/review/archive/receipt.md')
    expect(walk.excluded).toContainEqual({
      path: '.canon/memory/review/archive',
      files: 1,
    })
  })

  it('should leave a closed trail folder unswept and counted', async () => {
    const walk = await walkRecordTree(root)
    expect(
      walk.files.some((path) => path.startsWith('.canon/groundwork/')),
    ).toBe(false)
    expect(walk.excluded).toContainEqual({
      path: '.canon/groundwork',
      files: 1,
    })
    expect(walk.excluded).toContainEqual({ path: '.canon/intake', files: 1 })
  })

  it('should leave the scratch folder unswept', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.files.some((path) => path.startsWith('.canon/tmp/'))).toBe(
      false,
    )
    expect(walk.excluded).toContainEqual({ path: '.canon/tmp', files: 1 })
  })

  it('should skip the backup history by name rather than counting it', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.skipped).toEqual([`.canon/${OBJECT_STORE}`])
    expect(walk.excluded.map((corpus) => corpus.path)).not.toContain(
      `.canon/${OBJECT_STORE}`,
    )
  })

  it('should count a loose file at the record root as excluded', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.excluded).toContainEqual({ path: '.canon/README.md', files: 1 })
  })

  it('should never reach the old root, where the old spelling is correct', async () => {
    const walk = await walkRecordTree(root)
    expect(walk.files.some((path) => path.startsWith('.claude/'))).toBe(false)
  })

  it('should find nothing in a project with no record root', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'canon-record-tree-empty-'))
    const walk = await walkRecordTree(empty)

    expect(walk.files).toEqual([])
    expect(walk.excluded).toEqual([])
    rmSync(empty, { recursive: true, force: true })
  })
})

describe('planRecordTree', () => {
  it('should rewrite a live citation and name the line it sits on', async () => {
    const plan = await planFrom(root)
    const entry = plan.entries.find(
      (candidate) => candidate.path === '.canon/tasks/v1.1-row.md',
    )

    expect(entry?.text).toBe('Plan: .canon/plans/feature-x.md\n')
    expect(entry?.lines).toEqual([
      { line: 1, text: 'Plan: .claude/plans/feature-x.md' },
    ])
  })

  it('should leave a marked line alone and count it as kept', async () => {
    write(
      '.canon/tasks/v1.2-dated.md',
      '<!-- canon-keep-record-root -->\nThe defect landed in .claude/tasks/ back then.\n',
    )

    const plan = await planFrom(root)
    const paths = plan.entries.map((entry) => entry.path)

    expect(paths).not.toContain('.canon/tasks/v1.2-dated.md')
    expect(plan.kept).toBe(1)
  })

  it('should carry the excluded counts and the skipped store through', async () => {
    const plan = await planFrom(root)

    expect(plan.excluded).toContainEqual({ path: '.canon/tmp', files: 1 })
    expect(plan.skipped).toEqual([`.canon/${OBJECT_STORE}`])
  })
})

describe('applyRecordTree', () => {
  it('should write the plan and rewrite nothing on a second run', async () => {
    const first = await planFrom(root)
    const applied = await applyRecordTree(root, first)

    expect(applied.written).toBe(first.entries.length)
    expect(applied.failed).toEqual([])
    expect(readFileSync(join(root, '.canon/tasks/v1.1-row.md'), 'utf8')).toBe(
      'Plan: .canon/plans/feature-x.md\n',
    )

    const second = await planFrom(root)
    expect(second.entries).toEqual([])
    expect(second.rewritten).toBe(0)
  })

  it('should leave every excluded corpus on disk untouched', async () => {
    await applyRecordTree(root, await planFrom(root))

    for (const path of [
      '.canon/plans/archive/feature-shipped.md',
      '.canon/groundwork/01-trail/notes.md',
      '.canon/tmp/scratch/note.md',
      '.claude/tasks/v1.1-row.md',
    ]) {
      expect(readFileSync(join(root, path), 'utf8')).toBe(LIVE_CITATION)
    }
  })
})
