import { describe, expect, it } from 'vitest'
import {
  isInert,
  readCarry,
  readMergeCarry,
  readRebaseCarry,
  readUiCarry,
  type RebaseRead,
} from '@/pr/carry'
import type { ChangedRead } from '@/pr/lift'

const DRIVEN = '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TIP = '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function changedRead(read: ChangedRead | undefined) {
  return async (): Promise<ChangedRead | undefined> => read
}

function rebaseRead(read: RebaseRead | undefined) {
  return async (): Promise<RebaseRead | undefined> => read
}

describe('isInert', () => {
  it.each([
    'src/pr/lift.test.ts',
    'src/App.spec.tsx',
    'src/Button.stories.tsx',
    'src/__tests__/render.ts',
    'src/__snapshots__/card.snap',
    'README.md',
    'docs/guide.md',
    'docs/board.md',
    'canon/context/board/shell.md',
    '.claude/skills/internal-docs/SKILL.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'evidence/board/light.png',
    'canon/design/board/frame.html',
  ])('should classify %s as inert', (path) => {
    expect(isInert(path)).toBe(true)
  })

  it.each([
    'src/gesture.ts',
    'src/App.tsx',
    'src/data/boards.json',
    'docs/page.mdx',
    'src/pages/about.md',
    'src/pages/about.mdx',
    'src/content/blog/a.md',
    'content/blog/post.md',
    'web/README.md',
    'vite.config.ts',
    'evidence/capture.ts',
  ])('should classify %s as driven', (path) => {
    expect(isInert(path)).toBe(false)
  })
})

describe('readCarry', () => {
  it('should read covered when the driven commit is the head', async () => {
    const carry = await readCarry(
      changedRead(undefined),
      DRIVEN.slice(0, 7),
      DRIVEN,
    )

    expect(carry).toEqual({ kind: 'covered' })
  })

  it('should carry across a gap of tests and markdown', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/gesture.test.ts', 'README.md'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should carry across a gap of evidence captures alone', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['evidence/board/light.png', 'evidence/board/dark.png'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should move on a gap touching a non-painted source file', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/gesture.ts', 'src/gesture.test.ts'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['src/gesture.ts'] })
  })

  it('should name only the driven paths of a mixed gap', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['CHANGELOG.md', 'src/Card.tsx', 'src/data.json'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({
      kind: 'moved',
      drivenPaths: ['src/Card.tsx', 'src/data.json'],
    })
  })

  it('should carry across a source change the predicate lets through', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/capture/render.ts', 'src/gesture.ts'],
    })

    const carry = await readCarry(read, DRIVEN, TIP, (path) =>
      path.startsWith('src/take/'),
    )

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should move on a path the predicate names however inert it reads', async () => {
    const read = changedRead({ isAncestor: true, paths: ['README.md'] })

    const carry = await readCarry(read, DRIVEN, TIP, () => true)

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['README.md'] })
  })

  it('should never carry from a commit the head does not descend from', async () => {
    const read = changedRead({ isAncestor: false, paths: [] })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'not-ancestor' })
  })

  it('should read failed when the gap could not be read', async () => {
    const carry = await readCarry(changedRead(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'failed' })
  })
})

describe('readUiCarry', () => {
  function reads(
    changed: ChangedRead | undefined,
    rebased?: RebaseRead,
  ): Parameters<typeof readUiCarry>[0] {
    return {
      readChanged: changedRead(changed),
      readRebased: rebaseRead(rebased),
    }
  }

  it('should carry across a push of tests and markdown', async () => {
    const carry = await readUiCarry(
      reads({ isAncestor: true, paths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({
      kind: 'carried',
      carriedFrom: DRIVEN,
      carriedAcross: 'push',
    })
  })

  it('should carry across a rebase whose differing paths are inert', async () => {
    const carry = await readUiCarry(
      reads(
        { isAncestor: false, paths: [] },
        { differingPaths: ['README.md'] },
      ),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({
      kind: 'carried',
      carriedFrom: DRIVEN,
      carriedAcross: 'rebase',
    })
  })

  it('should move on a rebase that changed a driven path', async () => {
    const carry = await readUiCarry(
      reads(
        { isAncestor: false, paths: [] },
        { differingPaths: ['README.md', 'src/App.tsx'] },
      ),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['src/App.tsx'] })
  })

  it('should read behind when the rebase comparison could not be read', async () => {
    const carry = await readUiCarry(
      reads({ isAncestor: false, paths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'behind' })
  })

  it('should read failed when the gap could not be read', async () => {
    const carry = await readUiCarry(reads(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'failed' })
  })
})

describe('readRebaseCarry', () => {
  it('should carry when the branch diff is equal at both commits', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'rebased', carriedFrom: DRIVEN })
  })

  it('should refuse a differing inert path by default', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['README.md'] })
  })

  it('should carry across a differing inert path the predicate lets through', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: ['README.md', 'src/a.test.ts'] }),
      DRIVEN,
      TIP,
      (path) => !isInert(path),
    )

    expect(carry).toEqual({ kind: 'rebased', carriedFrom: DRIVEN })
  })

  it('should name only the differing driven paths', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: ['README.md', 'src/App.tsx'] }),
      DRIVEN,
      TIP,
      (path) => !isInert(path),
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['src/App.tsx'] })
  })

  it('should carry nothing when the comparison could not be read', async () => {
    const carry = await readRebaseCarry(rebaseRead(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'unread' })
  })
})

describe('readMergeCarry', () => {
  function reads(
    unmerged: readonly string[] | undefined,
    rebased?: RebaseRead,
  ): Parameters<typeof readMergeCarry>[0] {
    return {
      readUnmerged: async () => unmerged,
      readRebased: rebaseRead(rebased),
    }
  }

  it('should carry across merges of the base with the branch diff equal', async () => {
    const carry = await readMergeCarry(
      reads([], { differingPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'merged', carriedFrom: DRIVEN })
  })

  it('should name the differing paths when a merge changed the branch diff', async () => {
    const carry = await readMergeCarry(
      reads([], { differingPaths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['README.md'] })
  })

  it('should refuse a commit of the branch even with the diff equal', async () => {
    const carry = await readMergeCarry(
      reads([TIP], { differingPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'unmerged' })
  })

  it('should carry nothing when the commits could not be listed', async () => {
    const carry = await readMergeCarry(
      reads(undefined, { differingPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'unread' })
  })

  it('should carry nothing when the comparison could not be read', async () => {
    const carry = await readMergeCarry(reads([]), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'unread' })
  })
})
