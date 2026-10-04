import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { snapshotRoot, snapshotTree, writesBetween } from '@/sandbox/headless/watch'

let root: string

const writeFile = (path: string, body: string): void => {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), body, 'utf8')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandbox-watch-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('writesBetween', () => {
  // A file removed outside the declared scope has to produce an assertion, so
  // the before side of a change counts as a write as well as the after side.
  it('should report a deleted file as a write', () => {
    writeFile('keep.md', 'kept')
    writeFile('gone.md', 'doomed')
    const before = snapshotTree(root)
    rmSync(join(root, 'gone.md'))

    expect(writesBetween(before, snapshotTree(root))).toEqual(['gone.md'])
  })

  it('should name a modified file once rather than once per side', () => {
    writeFile('notes/plan.md', 'first')
    const before = snapshotTree(root)
    writeFile('notes/plan.md', 'second')

    expect(writesBetween(before, snapshotTree(root))).toEqual(['notes/plan.md'])
  })

  it('should report a created file and leave an untouched one out', () => {
    writeFile('old.md', 'same')
    const before = snapshotTree(root)
    writeFile('new.md', 'fresh')

    expect(writesBetween(before, snapshotTree(root))).toEqual(['new.md'])
  })
})

describe('snapshotTree', () => {
  it('should leave the top-level git folder out of the manifest', () => {
    writeFile('.git/HEAD', 'ref: refs/heads/main')
    writeFile('tracked.md', 'body')

    expect([...snapshotTree(root).keys()]).toEqual(['tracked.md'])
  })
})

describe('snapshotRoot', () => {
  // A root with none of the four folders reads identically to a watch that ran
  // clean, so the flag is what lets the check tell the two apart.
  it('should report unwatched when the root holds none of the scratch folders', () => {
    writeFile('.canon/tmp/scratch.md', 'not watched')

    const snapshot = snapshotRoot(root)

    expect(snapshot.isWatched).toBe(false)
    expect(snapshot.manifest.size).toBe(0)
  })

  it('should read only the scratch folders when the root holds one', () => {
    writeFile('.canon/plans/feature-x.md', 'plan')
    writeFile('src/app.ts', 'ignored')

    const snapshot = snapshotRoot(root)

    expect(snapshot.isWatched).toBe(true)
    expect([...snapshot.manifest.keys()]).toEqual(['.canon/plans/feature-x.md'])
  })
})
